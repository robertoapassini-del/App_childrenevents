import { describe, expect, it } from "vitest";
import {
  advisoryFor,
  effectiveSetting,
  iconForCode,
  shouldWarnAboutWeather,
  verdictFor,
  type WeatherSnapshot,
} from "@/lib/weather";

const pleasant: WeatherSnapshot = {
  temperatureC: 21,
  precipitationProbability: 5,
  weatherCode: 0,
  windSpeedKmh: 8,
};

const snapshot = (overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot => ({
  ...pleasant,
  ...overrides,
});

describe("iconForCode", () => {
  it.each([
    [0, "clear"],
    [1, "partly"],
    [2, "partly"],
    [3, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [53, "drizzle"],
    [63, "rain"],
    [73, "snow"],
    [81, "rain"],
    [85, "snow"],
    [95, "thunder"],
  ])("maps WMO code %i to %s", (code, expected) => {
    expect(iconForCode(code)).toBe(expected);
  });

  it("falls back to cloudy for a code it doesn't recognise", () => {
    expect(iconForCode(999)).toBe("cloudy");
  });
});

describe("advisoryFor", () => {
  it("calls a mild sunny afternoon good", () => {
    expect(advisoryFor(pleasant)).toBe("GOOD");
  });

  it("rules out rain", () => {
    expect(advisoryFor(snapshot({ weatherCode: 63 }))).toBe("POOR");
  });

  it("rules out thunderstorms", () => {
    expect(advisoryFor(snapshot({ weatherCode: 95 }))).toBe("POOR");
  });

  it("rules out snow", () => {
    expect(advisoryFor(snapshot({ weatherCode: 73 }))).toBe("POOR");
  });

  it("rules out a high chance of rain even under a clear code", () => {
    expect(advisoryFor(snapshot({ precipitationProbability: 80 }))).toBe("POOR");
  });

  it("rules out freezing weather", () => {
    expect(advisoryFor(snapshot({ temperatureC: 1 }))).toBe("POOR");
  });

  it("rules out serious heat", () => {
    expect(advisoryFor(snapshot({ temperatureC: 33 }))).toBe("POOR");
  });

  it("rules out strong wind", () => {
    expect(advisoryFor(snapshot({ windSpeedKmh: 45 }))).toBe("POOR");
  });

  it("treats drizzle as borderline rather than a hard no", () => {
    expect(advisoryFor(snapshot({ weatherCode: 53 }))).toBe("MARGINAL");
  });

  it("treats fog as borderline", () => {
    expect(advisoryFor(snapshot({ weatherCode: 45 }))).toBe("MARGINAL");
  });

  it("treats a chilly-but-dry day as borderline, not good", () => {
    // A grown-up would walk in this happily; a toddler in a pushchair would not.
    expect(advisoryFor(snapshot({ temperatureC: 7 }))).toBe("MARGINAL");
  });

  it("treats a moderate chance of rain as borderline", () => {
    expect(advisoryFor(snapshot({ precipitationProbability: 40 }))).toBe(
      "MARGINAL",
    );
  });

  it("keeps a warm breezy day good", () => {
    expect(advisoryFor(snapshot({ windSpeedKmh: 18 }))).toBe("GOOD");
  });
});

describe("verdictFor", () => {
  it("carries the snapshot through alongside the verdict", () => {
    const verdict = verdictFor(snapshot({ weatherCode: 63 }));
    expect(verdict.advisory).toBe("POOR");
    expect(verdict.icon).toBe("rain");
    expect(verdict.temperatureC).toBe(21);
  });
});

describe("effectiveSetting", () => {
  it("leaves an indoor activity indoors whatever the sky is doing", () => {
    expect(effectiveSetting("INDOOR", verdictFor(pleasant))).toBe("INDOOR");
  });

  it("leaves an outdoor activity outdoors even in bad weather", () => {
    // The venue doesn't move; the warning is a separate signal.
    expect(effectiveSetting("OUTDOOR", verdictFor(snapshot({ weatherCode: 63 })))).toBe(
      "OUTDOOR",
    );
  });

  it("sends a flexible activity outside when the weather is good", () => {
    expect(effectiveSetting("EITHER", verdictFor(pleasant))).toBe("OUTDOOR");
  });

  it("keeps a flexible activity inside when the weather is not", () => {
    expect(
      effectiveSetting("EITHER", verdictFor(snapshot({ weatherCode: 63 }))),
    ).toBe("INDOOR");
  });

  it("defaults a flexible activity indoors when there is no forecast", () => {
    expect(effectiveSetting("EITHER", null)).toBe("INDOOR");
  });
});

describe("shouldWarnAboutWeather", () => {
  it("warns about an outdoor activity in bad weather", () => {
    expect(
      shouldWarnAboutWeather("OUTDOOR", verdictFor(snapshot({ weatherCode: 63 }))),
    ).toBe(true);
  });

  it("says nothing about an indoor activity in bad weather", () => {
    expect(
      shouldWarnAboutWeather("INDOOR", verdictFor(snapshot({ weatherCode: 63 }))),
    ).toBe(false);
  });

  it("says nothing when the weather is fine", () => {
    expect(shouldWarnAboutWeather("OUTDOOR", verdictFor(pleasant))).toBe(false);
  });

  it("stays quiet rather than guessing when there is no forecast", () => {
    expect(shouldWarnAboutWeather("OUTDOOR", null)).toBe(false);
  });
});
