import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the config module first
vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    telegram: 0,
    telegramCustom: 1001,
  },
}));

// Mock the helpers module
vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getContactUrl: (id: number) => `https://example.com/contact/${id}`,
  };
});

import { planfixRequest } from "../helpers.js";
import { updatePlanfixContact } from "./planfix_update_contact.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

const mockContact = {
  id: 1,
  name: "John",
  lastname: "Doe",
  email: "john.doe@example.com",
  phones: [{ number: "+1234567890", type: 1 }],
  customFieldData: [{ field: { id: 1001 }, value: "@telegram_username" }],
};

describe("planfix_update_contact tool", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (customContact?: Partial<typeof mockContact>) => {
    mockPlanfixRequest.mockReset();
    mockPlanfixRequest.mockImplementation(async (args: any) => {
      const endpoint = args.path;
      if (endpoint.startsWith("contact/") && endpoint !== "contact/1") {
        throw new Error("Contact not found");
      }
      return { contact: { ...mockContact, ...customContact } };
    });
  };

  it("updates email when forceUpdate is true", async () => {
    setupMocks();
    mockPlanfixRequest.mockResolvedValueOnce({ contact: mockContact });
    mockPlanfixRequest.mockResolvedValueOnce({});

    const result = await updatePlanfixContact({
      contactId: 1,
      email: "new@example.com",
      forceUpdate: true,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(1, {
      path: "contact/1",
      body: { fields: "id,name,lastname,email,phones,customFieldData" },
      method: "GET",
    });
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(2, {
      path: "contact/1",
      body: { email: "new@example.com" },
    });
    expect(result.contactId).toBe(1);
    expect(result.url).toBe("https://example.com/contact/1");
  });

  it("does not update email when value is the same and forceUpdate is false", async () => {
    setupMocks();
    mockPlanfixRequest.mockResolvedValueOnce({ contact: mockContact });

    const result = await updatePlanfixContact({
      contactId: 1,
      email: mockContact.email,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe(1);
  });

  it("updates name and splits it into first and last name", async () => {
    setupMocks({ name: "", lastname: "" });
    mockPlanfixRequest.mockResolvedValueOnce({
      contact: { ...mockContact, name: "", lastname: "" },
    });
    mockPlanfixRequest.mockResolvedValueOnce({});

    const result = await updatePlanfixContact({
      contactId: 1,
      name: "John Smith",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(2, {
      path: "contact/1",
      body: { name: "John", lastname: "Smith" },
    });
    expect(result.contactId).toBe(1);
  });

  it("updates telegram username when different", async () => {
    // Set up initial mock response for GET contact
    mockPlanfixRequest.mockReset();

    // First call: GET contact with existing telegram
    mockPlanfixRequest.mockResolvedValueOnce({
      contact: {
        ...mockContact,
        customFieldData: [{ field: { id: 1001 }, value: "@old_username" }],
      },
    });

    // Second call: UPDATE contact
    mockPlanfixRequest.mockResolvedValueOnce({});

    const result = await updatePlanfixContact({
      contactId: 1,
      telegram: "new_username",
      forceUpdate: true, // Force update to ensure the change is applied
    });

    // Verify the GET call
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(1, {
      path: "contact/1",
      body: { fields: "id,name,lastname,email,phones,customFieldData" },
      method: "GET",
    });

    // Verify the UPDATE call
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(2, {
      path: "contact/1",
      body: {
        customFieldData: [{ field: { id: 1001 }, value: "@new_username" }],
      },
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(result.contactId).toBe(1);
  });

  it("does not update telegram username when same", async () => {
    // Set up initial mock response for GET contact
    mockPlanfixRequest.mockReset();

    // Only expect GET call, no UPDATE
    mockPlanfixRequest.mockResolvedValueOnce({
      contact: {
        ...mockContact,
        customFieldData: [{ field: { id: 1001 }, value: "@existing_username" }],
      },
    });

    const result = await updatePlanfixContact({
      contactId: 1,
      telegram: "existing_username",
    });

    // Verify only GET call was made
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "contact/1",
      body: { fields: "id,name,lastname,email,phones,customFieldData" },
      method: "GET",
    });

    expect(result.contactId).toBe(1);
  });

  it("adds new phone number when not existing", async () => {
    const newPhone = "+1987654321";
    setupMocks();
    mockPlanfixRequest.mockResolvedValueOnce({ contact: mockContact });
    mockPlanfixRequest.mockResolvedValueOnce({});

    const result = await updatePlanfixContact({
      contactId: 1,
      phone: newPhone,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(2, {
      path: "contact/1",
      body: { phones: [...mockContact.phones, { number: newPhone, type: 1 }] },
    });
    expect(result.contactId).toBe(1);
  });

  it("handles dry run mode", async () => {
    // Save the original implementation
    const originalConfig = await import("../config.js");

    try {
      // Mock the config to enable dry run
      vi.doMock("../config.js", () => ({
        ...originalConfig,
        PLANFIX_DRY_RUN: true,
        PLANFIX_FIELD_IDS: {
          telegram: 0,
          telegramCustom: 1001,
        },
      }));

      // Mock the helpers
      vi.doMock("../helpers.js", async () => {
        const actual =
          await vi.importActual<typeof import("../helpers.js")>(
            "../helpers.js",
          );
        return {
          ...actual,
          planfixRequest: vi.fn().mockResolvedValue({}),
          getContactUrl: (id: number) => `https://example.com/contact/${id}`,
          getToolWithHandler: actual.getToolWithHandler,
        };
      });

      // Re-import the module to get the updated mocks
      const { updatePlanfixContact } = await import(
        "./planfix_update_contact.js"
      );
      const { planfixRequest: mockPlanfixRequest } = await import(
        "../helpers.js"
      );

      const result = await updatePlanfixContact({
        contactId: 1,
        email: "test@example.com",
      });

      expect(result.contactId).toBe(1);
      expect(result.url).toBe("https://example.com/contact/1");
      // In dry run mode, no API calls should be made
      expect(mockPlanfixRequest).not.toHaveBeenCalled();
    } finally {
      // Restore the original mocks
      vi.resetModules();
    }
  });

  it("handles API errors", async () => {
    const errorMessage = "API Error";
    mockPlanfixRequest.mockReset();
    mockPlanfixRequest.mockRejectedValueOnce(new Error(errorMessage));

    const result = await updatePlanfixContact({
      contactId: 1,
      email: "test@example.com",
    });

    expect(result.contactId).toBe(0);
    expect(result.error).toBe(errorMessage);
  });
});
