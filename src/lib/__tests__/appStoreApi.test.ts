import { fetchStoreRelease } from "../appStoreApi";

const STORE_HIT = {
  resultCount: 1,
  results: [
    { version: "1.1.0", trackViewUrl: "https://apps.apple.com/it/app/pacetasks/id123", releaseNotes: " Reminders. " },
  ],
};
const STORE_MISS = { resultCount: 0, results: [] };

function mockFetch(...answers: object[]) {
  const fetchMock = jest.fn();
  answers.forEach((body) => fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("fetchStoreRelease", () => {
  it("asks the phone's storefront and reads the release", async () => {
    const fetchMock = mockFetch(STORE_HIT);
    await expect(fetchStoreRelease("com.pacetasks.app", "it-IT")).resolves.toEqual({
      version: "1.1.0",
      storeUrl: "https://apps.apple.com/it/app/pacetasks/id123",
      releaseNotes: "Reminders.",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("bundleId=com.pacetasks.app");
    expect(fetchMock.mock.calls[0][0]).toContain("country=it");
  });

  it("falls back to Apple's default storefront when the region has no listing", async () => {
    const fetchMock = mockFetch(STORE_MISS, STORE_HIT);
    await expect(fetchStoreRelease("com.pacetasks.app", "tr-TR")).resolves.toMatchObject({ version: "1.1.0" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).not.toContain("country=");
  });

  it("returns null while the app isn't on the store", async () => {
    mockFetch(STORE_MISS);
    await expect(fetchStoreRelease("com.pacetasks.app", "en")).resolves.toBeNull();
  });

  it("throws on a bad answer, so the hook retries next launch", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    await expect(fetchStoreRelease("com.pacetasks.app", "it-IT")).rejects.toThrow("503");
  });
});
