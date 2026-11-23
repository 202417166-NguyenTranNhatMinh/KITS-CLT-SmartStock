CREATE TABLE document_counters (
    prefix  VARCHAR(2) NOT NULL,
    day     DATE       NOT NULL,
    last_no INTEGER    NOT NULL DEFAULT 0,

    CONSTRAINT pk_document_counters PRIMARY KEY (prefix, day),
    CONSTRAINT ck_document_counters_prefix CHECK (prefix IN ('PN', 'PX'))
);
