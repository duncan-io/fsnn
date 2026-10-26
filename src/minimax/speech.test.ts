import { describe, expect, test } from "bun:test";
import { readSpeech } from "./speech";

describe("readSpeech", () => {
  test("decodes the hex audio and reads the duration", () => {
    const clip = readSpeech({
      base_resp: { status_code: 0, status_msg: "success" },
      data: { audio: "6869", status: 2 },
      extra_info: { audio_length: 250 },
    });
    expect(Buffer.from(clip.bytes).toString()).toBe("hi");
    expect(clip.durationMs).toBe(250);
  });

  test("rejects a MiniMax error and an empty clip", () => {
    expect(() => readSpeech({ base_resp: { status_code: 1004, status_msg: "bad sk-secret request" } })).toThrow(/\[key\]/);
    expect(() => readSpeech({ base_resp: { status_code: 0 }, data: { audio: "" }, extra_info: { audio_length: 1 } })).toThrow(
      /no audio/,
    );
    expect(() => readSpeech({ base_resp: { status_code: 0 }, data: { audio: "zz" }, extra_info: { audio_length: 1 } })).toThrow(
      /no audio/,
    );
  });
});
