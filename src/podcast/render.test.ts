import { describe, expect, test } from "bun:test";
import { joinMp3, lineForSpeech, stripId3 } from "./render";

describe("lineForSpeech", () => {
  test("inserts a pause after the first word when the speaker changes", () => {
    expect(lineForSpeech("Hello there friend", true)).toBe("Hello<#0.3#> there friend");
    expect(lineForSpeech("Hello there friend", false)).toBe("Hello there friend");
  });
});

describe("joinMp3", () => {
  test("strips ID3 tags and keeps the frame order", () => {
    const first = new Uint8Array([1, 2, 3, 4]);
    const second = new Uint8Array([5, 6]);
    const joined = joinMp3([withId3(first), withId3(second)]);
    expect([...joined]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...stripId3(withId3(first))]).toEqual([1, 2, 3, 4]);
  });
});

function withId3(payload: Uint8Array): Uint8Array {
  const body = new Uint8Array([9, 9, 9, 9]);
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 3, 0, 0]);
  header[9] = body.length;
  const footer = new Uint8Array(128);
  footer.set([0x54, 0x41, 0x47]);
  const out = new Uint8Array(header.length + body.length + payload.length + footer.length);
  out.set(header, 0);
  out.set(body, header.length);
  out.set(payload, header.length + body.length);
  out.set(footer, header.length + body.length + payload.length);
  return out;
}
