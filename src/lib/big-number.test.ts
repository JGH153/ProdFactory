import { describe, expect, it } from "vitest";
import {
	type BigNum,
	bigNum,
	bigNumZero,
	bnAdd,
	bnDeserialize,
	bnFloor,
	bnFormat,
	bnGte,
	bnIsZero,
	bnMul,
	bnPow,
	bnSerialize,
	bnSqrt,
	bnSub,
	bnToNumber,
} from "./big-number";

// Helper: compare BigNums with float tolerance
const expectBnApprox = (actual: BigNum, expected: BigNum, precision = 10) => {
	expect(actual.exponent).toBe(expected.exponent);
	expect(actual.mantissa).toBeCloseTo(expected.mantissa, precision);
};

describe("bigNum constructor", () => {
	it("returns bigNumZero for 0", () => {
		expect(bigNum(0)).toEqual(bigNumZero);
	});

	it("normalizes 10 to {mantissa:1, exponent:1}", () => {
		expect(bigNum(10)).toEqual({ mantissa: 1, exponent: 1 });
	});

	it("normalizes 100 to {mantissa:1, exponent:2}", () => {
		expect(bigNum(100)).toEqual({ mantissa: 1, exponent: 2 });
	});

	it("normalizes 1e6 to {mantissa:1, exponent:6}", () => {
		expect(bigNum(1e6)).toEqual({ mantissa: 1, exponent: 6 });
	});

	it("handles decimal: bigNum(2.5) = {mantissa:2.5, exponent:0}", () => {
		expect(bigNum(2.5)).toEqual({ mantissa: 2.5, exponent: 0 });
	});

	it("throws on negative numbers", () => {
		expect(() => bigNum(-1)).toThrow(
			"BigNum does not support negative numbers",
		);
	});

	it("throws on Infinity", () => {
		expect(() => bigNum(Infinity)).toThrow(
			"BigNum does not support Infinity or NaN",
		);
	});

	it("throws on NaN", () => {
		expect(() => bigNum(NaN)).toThrow(
			"BigNum does not support Infinity or NaN",
		);
	});
});

describe("bnAdd", () => {
	it("adds two small numbers: 2 + 3 = 5", () => {
		expectBnApprox(bnAdd(bigNum(2), bigNum(3)), bigNum(5));
	});

	it("zero left identity: 0 + 5 returns the b value", () => {
		expect(bnAdd(bigNumZero, bigNum(5))).toEqual(bigNum(5));
	});

	it("zero right identity: 5 + 0 returns the a value", () => {
		expect(bnAdd(bigNum(5), bigNumZero)).toEqual(bigNum(5));
	});

	it("large exponent difference: 1e100 + 1 ≈ 1e100 (b negligible)", () => {
		expect(bnAdd(bigNum(1e100), bigNum(1))).toEqual(bigNum(1e100));
	});

	it("large exponent difference: 1 + 1e100 ≈ 1e100 (a negligible)", () => {
		expect(bnAdd(bigNum(1), bigNum(1e100))).toEqual(bigNum(1e100));
	});

	it("cross-magnitude carry: 999 + 1 = 1000", () => {
		expectBnApprox(bnAdd(bigNum(999), bigNum(1)), bigNum(1000));
	});

	it("same-magnitude sum: 5e6 + 5e6 = 1e7", () => {
		expectBnApprox(bnAdd(bigNum(5e6), bigNum(5e6)), bigNum(1e7));
	});
});

describe("bnSub", () => {
	it("subtracts: 5 - 3 = 2", () => {
		expectBnApprox(bnSub(bigNum(5), bigNum(3)), bigNum(2));
	});

	it("clamps to zero when b > a: 3 - 5 = 0", () => {
		expect(bnSub(bigNum(3), bigNum(5))).toEqual(bigNumZero);
	});

	it("zero right identity: 5 - 0 = 5", () => {
		expect(bnSub(bigNum(5), bigNumZero)).toEqual(bigNum(5));
	});

	it("zero minus something: 0 - 5 = 0", () => {
		expect(bnSub(bigNumZero, bigNum(5))).toEqual(bigNumZero);
	});

	it("large exponent difference: 1e100 - 1 ≈ 1e100 (b negligible)", () => {
		expect(bnSub(bigNum(1e100), bigNum(1))).toEqual(bigNum(1e100));
	});

	it("large exponent difference: 1 - 1e100 = 0 (b much larger, clamp)", () => {
		expect(bnSub(bigNum(1), bigNum(1e100))).toEqual(bigNumZero);
	});

	it("equal values: 5 - 5 = 0", () => {
		expect(bnSub(bigNum(5), bigNum(5))).toEqual(bigNumZero);
	});
});

describe("bnMul", () => {
	it("multiplies: 2 * 3 = 6", () => {
		expectBnApprox(bnMul(bigNum(2), bigNum(3)), bigNum(6));
	});

	it("zero propagation left: 0 * 5 = 0", () => {
		expect(bnMul(bigNumZero, bigNum(5))).toEqual(bigNumZero);
	});

	it("zero propagation right: 5 * 0 = 0", () => {
		expect(bnMul(bigNum(5), bigNumZero)).toEqual(bigNumZero);
	});

	it("large exponents: 1e50 * 1e50 has exponent ~100", () => {
		const result = bnMul(bigNum(1e50), bigNum(1e50));
		expect(result.exponent).toBe(100);
		expect(result.mantissa).toBeCloseTo(1, 5);
	});

	it("normalizes when product mantissa >= 10: 2.5 * 4 = 10", () => {
		expect(bnMul(bigNum(2.5), bigNum(4))).toEqual({ mantissa: 1, exponent: 1 });
	});
});

describe("bnPow", () => {
	it("exponent 0: any^0 = 1", () => {
		expect(bnPow(bigNum(5), 0)).toEqual({ mantissa: 1, exponent: 0 });
	});

	it("zero base: 0^5 = 0", () => {
		expect(bnPow(bigNumZero, 5)).toEqual(bigNumZero);
	});

	it("2^10 ≈ 1024", () => {
		const result = bnPow(bigNum(2), 10);
		expect(result.exponent).toBe(3);
		expect(result.mantissa).toBeCloseTo(1.024, 5);
	});

	it("1.15^50 has exponent 3 (≈1083)", () => {
		const result = bnPow(bigNum(1.15), 50);
		expect(result.exponent).toBe(3);
		expect(result.mantissa).toBeCloseTo(1.0836, 2);
	});
});

describe("bnGte", () => {
	it("greater: 5 >= 3 → true", () => {
		expect(bnGte(bigNum(5), bigNum(3))).toBe(true);
	});

	it("lesser: 3 >= 5 → false", () => {
		expect(bnGte(bigNum(3), bigNum(5))).toBe(false);
	});

	it("equal: 5 >= 5 → true", () => {
		expect(bnGte(bigNum(5), bigNum(5))).toBe(true);
	});

	it("cross-magnitude: 1e6 >= 999999 → true", () => {
		expect(bnGte(bigNum(1e6), bigNum(999999))).toBe(true);
	});

	it("zero equals zero: 0 >= 0 → true", () => {
		expect(bnGte(bigNumZero, bigNumZero)).toBe(true);
	});

	it("non-zero >= zero → true", () => {
		expect(bnGte(bigNum(1), bigNumZero)).toBe(true);
	});

	it("zero >= non-zero → false", () => {
		expect(bnGte(bigNumZero, bigNum(1))).toBe(false);
	});
});

describe("bnIsZero", () => {
	it("bigNumZero is zero", () => {
		expect(bnIsZero(bigNumZero)).toBe(true);
	});

	it("bigNum(0) is zero", () => {
		expect(bnIsZero(bigNum(0))).toBe(true);
	});

	it("non-zero is not zero", () => {
		expect(bnIsZero(bigNum(1))).toBe(false);
	});

	it("very small number is not zero", () => {
		expect(bnIsZero(bigNum(0.001))).toBe(false);
	});
});

describe("bnFloor", () => {
	it("floors 3.7 to 3", () => {
		expectBnApprox(bnFloor(bigNum(3.7)), bigNum(3));
	});

	it("floors 1.999 to 1", () => {
		expectBnApprox(bnFloor(bigNum(1.999)), bigNum(1));
	});

	it("floor of zero is zero", () => {
		expect(bnFloor(bigNumZero)).toEqual(bigNumZero);
	});

	it("floor of exact integer is unchanged", () => {
		expect(bnFloor(bigNum(5))).toEqual(bigNum(5));
	});

	it("large exponent (>=15) returns as-is", () => {
		const large = bigNum(1e16);
		expect(bnFloor(large)).toEqual(large);
	});
});

describe("bnFormat", () => {
	it("formats zero as '0'", () => {
		expect(bnFormat(bigNumZero)).toBe("0");
	});

	it("formats 1 as '1'", () => {
		expect(bnFormat(bigNum(1))).toBe("1");
	});

	it("formats 1000 with comma as '1,000'", () => {
		expect(bnFormat(bigNum(1000))).toBe("1,000");
	});

	it("formats 999999 with comma as '999,999'", () => {
		expect(bnFormat(bigNum(999999))).toBe("999,999");
	});

	it("formats 1e6 as '1.00 million'", () => {
		expect(bnFormat(bigNum(1e6))).toBe("1.00 million");
	});

	it("formats 1.5e6 as '1.50 million'", () => {
		expect(bnFormat(bigNum(1.5e6))).toBe("1.50 million");
	});

	it("formats 1e9 as '1.00 billion'", () => {
		expect(bnFormat(bigNum(1e9))).toBe("1.00 billion");
	});

	it("formats 1e12 as '1.00 trillion'", () => {
		expect(bnFormat(bigNum(1e12))).toBe("1.00 trillion");
	});

	it("formats 1e15 as '1.00 quadrillion'", () => {
		expect(bnFormat(bigNum(1e15))).toBe("1.00 quadrillion");
	});

	it("formats 1e18 as '1.00 quintillion'", () => {
		expect(bnFormat(bigNum(1e18))).toBe("1.00 quintillion");
	});

	it("formats 1e21 as '1.00 aa' (first letter notation)", () => {
		expect(bnFormat(bigNum(1e21))).toBe("1.00 aa");
	});

	it("formats 1e24 as '1.00 ab'", () => {
		expect(bnFormat(bigNum(1e24))).toBe("1.00 ab");
	});

	it("formats fractional value 0.86 as '0.86'", () => {
		expect(bnFormat(bigNum(0.86))).toBe("0.86");
	});

	it("formats fractional value 0.05 as '0.05'", () => {
		expect(bnFormat(bigNum(0.05))).toBe("0.05");
	});

	it("formats near-zero fractional value as '0'", () => {
		expect(bnFormat(bigNum(0.001))).toBe("0");
		expect(bnFormat(bigNum(0.004))).toBe("0");
	});
});

describe("bnSerialize / bnDeserialize", () => {
	it("serializes bigNum(42) to {m:4.2, e:1}", () => {
		const result = bnSerialize(bigNum(42));
		expect(result.m).toBeCloseTo(4.2, 10);
		expect(result.e).toBe(1);
	});

	it("serializes bigNumZero to {m:0, e:0}", () => {
		expect(bnSerialize(bigNumZero)).toEqual({ m: 0, e: 0 });
	});

	it("round-trip preserves value", () => {
		const original = bigNum(12345678);
		const result = bnDeserialize(bnSerialize(original));
		expect(result.exponent).toBe(original.exponent);
		expect(result.mantissa).toBeCloseTo(original.mantissa, 10);
	});

	it("deserializes {m:0, e:0} to bigNumZero", () => {
		expect(bnDeserialize({ m: 0, e: 0 })).toEqual(bigNumZero);
	});

	it("deserializes {m:1.5, e:6} to bigNum(1.5e6)", () => {
		const result = bnDeserialize({ m: 1.5, e: 6 });
		expect(result.mantissa).toBeCloseTo(1.5, 10);
		expect(result.exponent).toBe(6);
	});
});

describe("bnSqrt", () => {
	it("sqrt(0) = 0", () => {
		expect(bnSqrt(bigNumZero)).toEqual(bigNumZero);
	});

	it("sqrt(1) = 1", () => {
		expectBnApprox(bnSqrt(bigNum(1)), bigNum(1));
	});

	it("sqrt(4) = 2", () => {
		expectBnApprox(bnSqrt(bigNum(4)), bigNum(2));
	});

	it("sqrt(9) = 3", () => {
		expectBnApprox(bnSqrt(bigNum(9)), bigNum(3));
	});

	it("sqrt(100) = 10 (even exponent)", () => {
		expectBnApprox(bnSqrt(bigNum(100)), bigNum(10));
	});

	it("sqrt(1000000) = 1000 (even exponent)", () => {
		expectBnApprox(bnSqrt(bigNum(1000000)), bigNum(1000));
	});

	it("sqrt(1000) ≈ 31.62 (odd exponent)", () => {
		const result = bnSqrt(bigNum(1000));
		expect(result.exponent).toBe(1);
		expect(result.mantissa).toBeCloseTo(3.1622, 3);
	});

	it("sqrt(25) = 5", () => {
		expectBnApprox(bnSqrt(bigNum(25)), bigNum(5));
	});

	it("sqrt(10000) = 100", () => {
		expectBnApprox(bnSqrt(bigNum(10000)), bigNum(100));
	});
});

describe("bnToNumber", () => {
	it("converts zero to 0", () => {
		expect(bnToNumber(bigNumZero)).toBe(0);
	});

	it("converts bigNum(42) to 42", () => {
		expect(bnToNumber(bigNum(42))).toBeCloseTo(42, 10);
	});

	it("converts bigNum(1000000) to 1000000", () => {
		expect(bnToNumber(bigNum(1000000))).toBeCloseTo(1000000, 5);
	});

	it("converts small decimal bigNum(0.5) to 0.5", () => {
		expect(bnToNumber(bigNum(0.5))).toBeCloseTo(0.5, 10);
	});
});
