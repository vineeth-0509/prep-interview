import { describe, expect, it } from "vitest";
import { isSafeAddress } from "./urlSafety";

describe("isSafeAddress", () => {
  it("rejects IPv4 private ranges", () => {
    expect(isSafeAddress("10.0.0.5")).toBe(false);
    expect(isSafeAddress("172.16.0.1")).toBe(false);
    expect(isSafeAddress("172.31.255.255")).toBe(false);
    expect(isSafeAddress("192.168.1.1")).toBe(false);
  });

  it("rejects loopback and link-local", () => {
    expect(isSafeAddress("127.0.0.1")).toBe(false);
    expect(isSafeAddress("169.254.1.1")).toBe(false);
    expect(isSafeAddress("::1")).toBe(false);
    expect(isSafeAddress("fe80::1")).toBe(false);
  });

  it("rejects IPv6 unique-local addresses", () => {
    expect(isSafeAddress("fc00::1")).toBe(false);
    expect(isSafeAddress("fd00::1")).toBe(false);
  });

  it("accepts public addresses", () => {
    expect(isSafeAddress("8.8.8.8")).toBe(true);
    expect(isSafeAddress("142.250.80.46")).toBe(true);
    expect(isSafeAddress("2001:4860:4860::8888")).toBe(true);
  });

  it("rejects unparseable input rather than guessing", () => {
    expect(isSafeAddress("not-an-ip")).toBe(false);
    expect(isSafeAddress("")).toBe(false);
  });
});
