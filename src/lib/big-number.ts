/**
 * Custom BigNumber system for idle game math.
 * Represents numbers as mantissa * 10^exponent where 1.0 <= mantissa < 10.0 (or 0 for zero).
 * All operations are pure functions — no mutation.
 */

export type BigNum = {
	mantissa: number;
	exponent: number;
};

export type SerializedBigNum = {
	m: number;
	e: number;
};

// --- Constants ---

export const bigNumZero: BigNum = { mantissa: 0, exponent: 0 };
const bigNumOne: BigNum = { mantissa: 1, exponent: 0 };

// --- Constructor ---

export const bigNum = (value: number): BigNum => {
	if (value === 0) return bigNumZero;
	if (value < 0) throw new Error("BigNum does not support negative numbers");
	if (!Number.isFinite(value))
		throw new Error("BigNum does not support Infinity or NaN");

	const exponent = Math.floor(Math.log10(value));
	const mantissa = value / 10 ** exponent;

	return normalize({ mantissa, exponent });
};

// --- Normalization ---

const normalize = (bn: BigNum): BigNum => {
	if (bn.mantissa === 0) return bigNumZero;

	let { mantissa, exponent } = bn;

	while (mantissa >= 10) {
		mantissa /= 10;
		exponent += 1;
	}

	while (mantissa < 1 && mantissa > 0) {
		mantissa *= 10;
		exponent -= 1;
	}

	return { mantissa, exponent };
};

// --- Arithmetic ---

export const bnAdd = (a: BigNum, b: BigNum): BigNum => {
	if (a.mantissa === 0) return b;
	if (b.mantissa === 0) return a;

	const expDiff = a.exponent - b.exponent;

	// If difference is too large, the smaller number is negligible
	if (expDiff > 15) return a;
	if (expDiff < -15) return b;

	// Align to the larger exponent
	if (a.exponent >= b.exponent) {
		const alignedB = b.mantissa * 10 ** (b.exponent - a.exponent);
		return normalize({ mantissa: a.mantissa + alignedB, exponent: a.exponent });
	}

	const alignedA = a.mantissa * 10 ** (a.exponent - b.exponent);
	return normalize({ mantissa: alignedA + b.mantissa, exponent: b.exponent });
};

export const bnSub = (a: BigNum, b: BigNum): BigNum => {
	if (b.mantissa === 0) return a;
	if (a.mantissa === 0) return bigNumZero; // No negatives in this game

	const expDiff = a.exponent - b.exponent;

	// If a is much larger, b is negligible
	if (expDiff > 15) return a;
	// If b is much larger, result would be negative — clamp to zero
	if (expDiff < -15) return bigNumZero;

	let result: number;
	if (a.exponent >= b.exponent) {
		const alignedB = b.mantissa * 10 ** (b.exponent - a.exponent);
		result = a.mantissa - alignedB;
		if (result <= 0) return bigNumZero;
		return normalize({ mantissa: result, exponent: a.exponent });
	}

	const alignedA = a.mantissa * 10 ** (a.exponent - b.exponent);
	result = alignedA - b.mantissa;
	if (result <= 0) return bigNumZero;
	return normalize({ mantissa: result, exponent: b.exponent });
};

export const bnMul = (a: BigNum, b: BigNum): BigNum => {
	if (a.mantissa === 0 || b.mantissa === 0) return bigNumZero;

	return normalize({
		mantissa: a.mantissa * b.mantissa,
		exponent: a.exponent + b.exponent,
	});
};

export const bnPow = (base: BigNum, exp: number): BigNum => {
	if (exp === 0) return bigNumOne;
	if (base.mantissa === 0) return bigNumZero;

	// Use logarithmic approach for efficiency
	// log10(base^exp) = exp * log10(base) = exp * (log10(mantissa) + exponent)
	const log10Value = exp * (Math.log10(base.mantissa) + base.exponent);
	const newExponent = Math.floor(log10Value);
	const newMantissa = 10 ** (log10Value - newExponent);

	return normalize({ mantissa: newMantissa, exponent: newExponent });
};

// --- Comparisons ---

const bnGt = (a: BigNum, b: BigNum): boolean => {
	if (a.mantissa === 0 && b.mantissa === 0) return false;
	if (a.mantissa === 0) return false;
	if (b.mantissa === 0) return true;
	if (a.exponent !== b.exponent) return a.exponent > b.exponent;
	return a.mantissa > b.mantissa;
};

const bnLt = (a: BigNum, b: BigNum): boolean => bnGt(b, a);

export const bnGte = (a: BigNum, b: BigNum): boolean => !bnLt(a, b);

export const bnIsZero = (bn: BigNum): boolean => bn.mantissa === 0;

export const bnFloor = (bn: BigNum): BigNum => {
	if (bn.mantissa === 0) return bigNumZero;
	if (bn.exponent >= 15) return bn;
	const value = bn.mantissa * 10 ** bn.exponent;
	return bigNum(Math.floor(value));
};

// --- Conversion ---

const bnToNumber = (bn: BigNum): number => {
	if (bn.mantissa === 0) return 0;
	return bn.mantissa * 10 ** bn.exponent;
};

// --- Formatting ---

const STANDARD_NAMES = [
	"",
	"",
	"million",
	"billion",
	"trillion",
	"quadrillion",
	"quintillion",
] as const;

const getLetterSuffix = (index: number): string => {
	// index 0 = "aa", index 1 = "ab", ..., index 25 = "az", index 26 = "ba", etc.
	const first = String.fromCharCode(97 + Math.floor(index / 26));
	const second = String.fromCharCode(97 + (index % 26));
	return `${first}${second}`;
};

export const bnFormat = (bn: BigNum): string => {
	if (bn.mantissa === 0) return "0";

	const value = bnToNumber(bn);

	// Small numbers: display with commas
	if (bn.exponent < 6) {
		return Math.floor(value).toLocaleString("en-US");
	}

	// Group by 3s: 10^6 = million (group 2), 10^9 = billion (group 3), etc.
	const group = Math.floor(bn.exponent / 3);
	const remainder = bn.exponent % 3;
	const displayValue = bn.mantissa * 10 ** remainder;

	// Standard names up to quintillion (10^18)
	if (group < STANDARD_NAMES.length) {
		const name = STANDARD_NAMES[group];
		if (name === "") return Math.floor(value).toLocaleString("en-US");
		return `${displayValue.toFixed(2)} ${name}`;
	}

	// Letter notation: group 7 (10^21) = "aa", group 8 (10^24) = "ab", etc.
	const letterIndex = group - STANDARD_NAMES.length;
	const suffix = getLetterSuffix(letterIndex);
	return `${displayValue.toFixed(2)} ${suffix}`;
};

// --- Serialization ---

export const bnSerialize = (bn: BigNum): SerializedBigNum => ({
	m: bn.mantissa,
	e: bn.exponent,
});

export const bnDeserialize = (data: SerializedBigNum): BigNum =>
	normalize({ mantissa: data.m, exponent: data.e });
