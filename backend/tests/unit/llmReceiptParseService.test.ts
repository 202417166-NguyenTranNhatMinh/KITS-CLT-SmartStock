import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../src/common/errors";
import type { LlmProductOption, LlmSupplierOption } from "../../src/contracts/llm/receiptParse.contract";
import { MockLlmService, OpenAiCompatibleLlmService } from "../../src/services/llm/llmService";
import { createDefaultLlmService, ReceiptParseService } from "../../src/services/llm/receiptParseService";

const PRODUCTS: LlmProductOption[] = [
  { id: 1, sku: "RAU-001", name: "Cà chua", unit: "kg", price: 25000 },
  { id: 21, sku: "SUA-003", name: "Trứng gà ta", unit: "vỉ", price: 42000 },
];

const SUPPLIERS: LlmSupplierOption[] = [
  { id: 1, name: "Nông trại Đà Lạt Xanh" },
];

const catalogRepo = {
  async findActiveProducts() {
    return PRODUCTS;
  },
  async findSuppliers() {
    return SUPPLIERS;
  },
};

test("createDefaultLlmService falls back to MockLlmService when API key is missing", () => {
  const service = createDefaultLlmService({
    PORT: 4000,
    DATABASE_URL: "",
    FRONTEND_URL: "http://localhost:5173",
    JWT_SECRET: "secret",
    JWT_EXPIRES_IN_SECONDS: 3600,
    NODE_ENV: "test",
    LLM_PROVIDER: "auto",
    LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
    LLM_API_KEY: "",
    LLM_MODEL: "gemini-2.5-flash-lite",
    LLM_TIMEOUT_MS: 30000,
  });
  assert.ok(service instanceof MockLlmService);
});

test("ReceiptParseService with MockLlmService extracts items, k-prices, and unmatched lines without DB writes", async () => {
  const service = new ReceiptParseService(new MockLlmService(), catalogRepo);
  const result = await service.parse(
    "Nhà cung cấp Nông trại Đà Lạt Xanh\nCa chua 20 kg x 25k\nTrứng gà ta 10 vỉ x 32000\nBơ sáp 5 kg x 45000",
  );

  assert.equal(result.isSuggestionOnly, true);
  assert.equal(result.supplierId, 1);
  assert.deepEqual(result.items, [
    { productId: 1, productName: "Cà chua", quantity: 20, unitPrice: 25000, rawText: "Ca chua 20 kg x 25k" },
    { productId: 21, productName: "Trứng gà ta", quantity: 10, unitPrice: 32000, rawText: "Trứng gà ta 10 vỉ x 32000" },
  ]);
  assert.deepEqual(result.unmatched, ["Bơ sáp 5 kg x 45000"]);

  const inlineResult = await service.parse(
    "Nhà cung cấp Nông trại Đà Lạt Xanh. Cà chua 20 kg x 25k. Trứng gà ta 10 vỉ x 32000.",
  );
  assert.equal(inlineResult.supplierId, 1);
  assert.equal(inlineResult.items.length, 2);

  const mergedService = new ReceiptParseService(
    {
      async parseInvoice() {
        return JSON.stringify({
          supplierId: 1,
          items: [
            { productId: 1, quantity: 10, unitPrice: 25000, rawText: "Cà chua 10 kg" },
            { productId: 1, quantity: 5, unitPrice: 25000, rawText: "Cà chua thêm 5 kg" },
          ],
          unmatched: [],
        });
      },
    },
    catalogRepo,
  );
  const merged = await mergedService.parse("Cà chua 10 kg; Cà chua thêm 5 kg");
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0].quantity, 15);
  assert.equal(merged.items[0].rawText, "Cà chua 10 kg; Cà chua thêm 5 kg");
});

test("ReceiptParseService throws 400 when LLM returns malformed JSON", async () => {
  const service = new ReceiptParseService(
    { async parseInvoice() { return "{not valid json"; } },
    catalogRepo,
  );

  await assert.rejects(
    () => service.parse("Cà chua 10 kg"),
    (error: unknown) => error instanceof AppError && error.status === 400,
  );
});

test("ReceiptParseService throws 400 when LLM returns unknown productId or non-positive quantity", async () => {
  const unknownProductService = new ReceiptParseService(
    { async parseInvoice() { return JSON.stringify({ supplierId: 999, items: [{ productId: 999, quantity: 2 }], unmatched: [] }); } },
    catalogRepo,
  );
  await assert.rejects(
    () => unknownProductService.parse("Cà chua 2 kg"),
    (error: unknown) => error instanceof AppError && error.status === 400,
  );

  const badQtyService = new ReceiptParseService(
    { async parseInvoice() { return JSON.stringify({ supplierId: null, items: [{ productId: 1, quantity: 0 }], unmatched: [] }); } },
    catalogRepo,
  );
  await assert.rejects(
    () => badQtyService.parse("Cà chua 0 kg"),
    (error: unknown) => error instanceof AppError && error.status === 400,
  );
});

test("OpenAiCompatibleLlmService calls configured baseUrl, parses valid response, and throws 503 on error/timeout", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const llm = new OpenAiCompatibleLlmService({
      apiKey: "test-key",
      model: "gemini-2.5-flash-lite",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeoutMs: 1000,
    });

    let requestedUrl = "";
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ supplierId: 1, items: [{ productId: 1, quantity: 5, unitPrice: 25000, rawText: "Cà chua 5 kg" }], unmatched: [] }) } }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const okRaw = await llm.parseInvoice("Cà chua 5 kg", PRODUCTS, SUPPLIERS);
    assert.equal(requestedUrl, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    assert.equal(JSON.parse(okRaw).items[0].productId, 1);

    globalThis.fetch = (async () => new Response("upstream error", { status: 500 })) as typeof fetch;
    await assert.rejects(
      () => llm.parseInvoice("Cà chua 5 kg", PRODUCTS, SUPPLIERS),
      (error: unknown) => error instanceof AppError && error.status === 503,
    );

    globalThis.fetch = (async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }) as typeof fetch;

    await assert.rejects(
      () => llm.parseInvoice("Cà chua 5 kg", PRODUCTS, SUPPLIERS),
      (error: unknown) => error instanceof AppError && error.status === 503,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
