jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

import { render, screen } from "@testing-library/react-native";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import type { ReleaseGroup } from "@/lib/types/library";

const release = (listenerCount: number | null): ReleaseGroup => ({
  id: "rg-1",
  title: "I Might Be Wrong",
  "first-release-date": "2001-11-12",
  "primary-type": "Album",
  "secondary-types": ["Live"],
  listenerCount,
});

describe("ReleaseGroupCard", () => {
  it("shows the release's listeners on a line of their own", async () => {
    await render(<ReleaseGroupCard releaseGroup={release(1_234_567)} />);

    expect(screen.getByText("2001 · Album · Live")).toBeTruthy();
    expect(screen.getByLabelText("1.2M listeners")).toHaveTextContent("1.2M");
  });

  it("leaves the line out when ListenBrainz has no count", async () => {
    await render(<ReleaseGroupCard releaseGroup={release(null)} />);

    expect(screen.queryByLabelText(/listeners$/)).toBeNull();
  });
});
