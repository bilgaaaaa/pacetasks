import { DEFAULT_SETTINGS, fetchOrCreateSettings } from "../settingsApi";

// A stand-in for the Supabase query builder: each awaited query takes the next queued result.
const mockResults: { data: unknown; error: unknown }[] = [];
const mockInsert = jest.fn();
jest.mock("../supabase", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    insert: (row: unknown) => {
      mockInsert(row);
      return builder;
    },
    maybeSingle: () => Promise.resolve(mockResults.shift()),
    single: () => Promise.resolve(mockResults.shift()),
  };
  return { supabase: { from: () => builder } };
});

const ROW = { user_id: "user-1", ...DEFAULT_SETTINGS, updated_at: "2026-10-11T19:00:00.000Z" };

describe("fetchOrCreateSettings", () => {
  beforeEach(() => {
    mockResults.length = 0;
    mockInsert.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns the existing row without creating one", async () => {
    mockResults.push({ data: ROW, error: null });
    await expect(fetchOrCreateSettings("user-1")).resolves.toEqual(ROW);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates the row with the defaults for a new user", async () => {
    mockResults.push({ data: null, error: null }, { data: ROW, error: null });
    await expect(fetchOrCreateSettings("user-1")).resolves.toEqual(ROW);
    expect(mockInsert).toHaveBeenCalledWith({ user_id: "user-1", ...DEFAULT_SETTINGS });
  });

  it("reads the row when another caller created it first", async () => {
    mockResults.push(
      { data: null, error: null },
      { data: null, error: { code: "23505", message: "duplicate key value" } },
      { data: ROW, error: null }
    );
    await expect(fetchOrCreateSettings("user-1")).resolves.toEqual(ROW);
  });

  it("still reports any other failure", async () => {
    const failure = { code: "42501", message: "permission denied" };
    mockResults.push({ data: null, error: null }, { data: null, error: failure });
    await expect(fetchOrCreateSettings("user-1")).rejects.toEqual(failure);
  });
});
