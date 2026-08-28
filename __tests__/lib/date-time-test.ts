jest.mock("@/lib/storage", () => ({
  AppStorage: {
    getDateTimeFormat: jest.fn(),
    setDateTimeFormat: jest.fn(),
    deleteDateTimeFormat: jest.fn(),
  },
}));

import { AppStorage } from "@/lib/storage";
import {
  forgetDateTimeFormat,
  formatDate,
  formatDateTime,
  formatTime,
  getDateTimeFormat,
  normalizeDateTimeFormat,
  restoreDateTimeFormat,
  setDateTimeFormat,
  subscribeToDateTimeFormat,
} from "@/lib/date-time";

const mockStorage = AppStorage as jest.Mocked<typeof AppStorage>;

// Local time, so the non-UTC branches read the device clock the way the app does.
const sample = new Date(2026, 3, 9, 7, 5);

beforeEach(() => {
  jest.clearAllMocks();
  setDateTimeFormat("browser");
  jest.clearAllMocks();
});

describe("normalizeDateTimeFormat", () => {
  it("keeps the three formats the server offers", () => {
    expect(normalizeDateTimeFormat("browser")).toBe("browser");
    expect(normalizeDateTimeFormat("day-first")).toBe("day-first");
    expect(normalizeDateTimeFormat("year-first")).toBe("year-first");
  });

  it("falls back to browser for an unknown or missing value", () => {
    expect(normalizeDateTimeFormat(undefined)).toBe("browser");
    expect(normalizeDateTimeFormat("iso-8601")).toBe("browser");
  });
});

describe("setDateTimeFormat", () => {
  it("stores the format and remembers it", () => {
    setDateTimeFormat("day-first");

    expect(getDateTimeFormat()).toBe("day-first");
    expect(mockStorage.setDateTimeFormat).toHaveBeenCalledWith("day-first");
  });

  it("normalizes what an older server omits", () => {
    setDateTimeFormat(undefined);

    expect(getDateTimeFormat()).toBe("browser");
    expect(mockStorage.setDateTimeFormat).toHaveBeenCalledWith("browser");
  });

  it("notifies subscribers only when the format changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToDateTimeFormat(listener);

    setDateTimeFormat("year-first");
    setDateTimeFormat("year-first");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setDateTimeFormat("day-first");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("restoreDateTimeFormat", () => {
  it("adopts the remembered format", async () => {
    mockStorage.getDateTimeFormat.mockResolvedValue("year-first");

    await restoreDateTimeFormat();

    expect(getDateTimeFormat()).toBe("year-first");
  });

  it("leaves the format alone when nothing is stored", async () => {
    mockStorage.getDateTimeFormat.mockResolvedValue(null);

    await restoreDateTimeFormat();

    expect(getDateTimeFormat()).toBe("browser");
  });
});

describe("forgetDateTimeFormat", () => {
  it("resets to browser and clears storage", async () => {
    setDateTimeFormat("day-first");

    await forgetDateTimeFormat();

    expect(getDateTimeFormat()).toBe("browser");
    expect(mockStorage.deleteDateTimeFormat).toHaveBeenCalled();
  });
});

describe("formatDate", () => {
  it("uses the device locale in browser mode", () => {
    expect(formatDate(sample)).toBe(sample.toLocaleDateString());
  });

  it("passes options through in browser mode", () => {
    const options = { month: "short", day: "numeric" } as const;
    expect(formatDate(sample, options)).toBe(
      sample.toLocaleDateString(undefined, options),
    );
  });

  it("renders day first", () => {
    setDateTimeFormat("day-first");
    expect(formatDate(sample)).toBe("09/04/2026");
  });

  it("renders year first", () => {
    setDateTimeFormat("year-first");
    expect(formatDate(sample)).toBe("2026/04/09");
  });

  it("ignores the options an explicit format cannot honor", () => {
    setDateTimeFormat("day-first");
    expect(formatDate(sample, { month: "short" })).toBe("09/04/2026");
  });

  it("reads UTC parts when the options ask for UTC", () => {
    setDateTimeFormat("year-first");
    const utc = new Date("2026-04-09T23:30:00Z");
    expect(formatDate(utc, { timeZone: "UTC" })).toBe("2026/04/09");
  });

  it("falls back to the locale for an invalid date", () => {
    setDateTimeFormat("day-first");
    const invalid = new Date("nonsense");
    expect(formatDate(invalid)).toBe(invalid.toLocaleDateString());
  });
});

describe("formatTime", () => {
  it("uses the device locale in browser mode", () => {
    expect(formatTime(sample)).toBe(sample.toLocaleTimeString());
  });

  it("renders 24-hour time for an explicit format", () => {
    setDateTimeFormat("day-first");
    expect(formatTime(sample)).toBe("07:05");
  });
});

describe("formatDateTime", () => {
  it("uses the device locale in browser mode", () => {
    expect(formatDateTime(sample)).toBe(sample.toLocaleString());
  });

  it("puts the time first for day-first, the date first for year-first", () => {
    setDateTimeFormat("day-first");
    expect(formatDateTime(sample)).toBe("07:05 09/04/2026");

    setDateTimeFormat("year-first");
    expect(formatDateTime(sample)).toBe("2026/04/09 07:05");
  });
});
