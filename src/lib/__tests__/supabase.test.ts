const mockGetSession = jest.fn();
const mockSignInAnonymously = jest.fn();

jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({}));
jest.mock("@supabase/supabase-js", () => ({
  // Wrapped in functions because the client is created on import, before the mocks above exist.
  createClient: () => ({
    auth: { getSession: () => mockGetSession(), signInAnonymously: () => mockSignInAnonymously() },
  }),
}));

import { ensureSession } from "../supabase";

const STORED = { user: { id: "stored-user" } };
const ANONYMOUS = { user: { id: "new-anonymous-user" } };

describe("ensureSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockSignInAnonymously.mockResolvedValue({ data: { session: ANONYMOUS }, error: null });
  });

  it("keeps the stored session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: STORED }, error: null });
    await expect(ensureSession()).resolves.toBe(STORED);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in anonymously only when there is no stored session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(ensureSession()).resolves.toBe(ANONYMOUS);
  });

  it("never replaces a stored session that could not be refreshed", async () => {
    const refreshFailed = new Error("Network request failed");
    mockGetSession.mockResolvedValue({ data: { session: null }, error: refreshFailed });
    await expect(ensureSession()).rejects.toBe(refreshFailed);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("shares one attempt between overlapping callers, and starts a new one afterwards", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const [first, second] = await Promise.all([ensureSession(), ensureSession()]);
    expect(first).toBe(second);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);

    await ensureSession();
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(2);
  });
});
