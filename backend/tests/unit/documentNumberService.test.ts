import assert from "node:assert/strict";
import test from "node:test";

import { DocumentNumberService, formatHoChiMinhDate } from "../../src/services/documentNumberService";

test("formats dates in Asia/Ho_Chi_Minh", () => {
  assert.equal(formatHoChiMinhDate(new Date("2026-11-21T17:30:00.000Z")), "20261122");
});

test("creates zero-padded receipt and issue codes", async () => {
  const calls: Array<[string, string]> = [];
  const service = new DocumentNumberService({
    async reserveNextSequence(prefix, date) {
      calls.push([prefix, date]);
      return prefix === "PN" ? 1 : 12;
    },
  });
  const createdAt = new Date("2026-11-21T17:30:00.000Z");

  assert.equal(await service.nextReceiptCode(createdAt), "PN-20261122-001");
  assert.equal(await service.nextIssueCode(createdAt), "PX-20261122-012");
  assert.deepEqual(calls, [["PN", "20261122"], ["PX", "20261122"]]);
});
