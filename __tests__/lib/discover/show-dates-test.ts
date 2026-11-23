import { formatShowDateLabel } from "@/lib/discover/show-dates";

// ICU puts a narrow no-break space before AM/PM.
const plain = (text: string | null) => text?.replace(/\s/g, " ");

describe("formatShowDateLabel", () => {
  it("writes Ticketmaster's venue time as a clock time", () => {
    const label = formatShowDateLabel({
      id: "s",
      artistNames: ["Aly & AJ"],
      sourceTypes: ["recommended"],
      date: "2026-11-28",
      time: "19:00:00",
    });

    expect(plain(label)).toBe("Nov 28, 2026 at 7:00 PM");
  });
});
