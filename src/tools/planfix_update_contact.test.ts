import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the config module first
vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    telegram: 0,
    telegramCustom: 1001,
  },
}));

// Mock custom fields config
vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: {
    contactFields: [
      { id: 37612, name: "status", type: "string" },
    ],
  },
}));

// Mock the helpers module
vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getContactUrl: (id: number) => `https://example.com/contact/${id}`,
    log: vi.fn(),
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

  const setupMocks = (customContact: Partial<typeof mockContact> = {}) => {
    mockPlanfixRequest.mockReset();
    mockPlanfixRequest.mockImplementation(async (args: any) => {
      if (args.path === `contact/${mockContact.id}`) {
        return { contact: { ...mockContact, ...customContact } };
      }
      throw new Error(`Unexpected path: ${args.path}`);
    });
    
    // Mock the custom fields extension
    vi.mock("../lib/extendPostBodyWithCustomFields.js", () => ({
      extendPostBodyWithCustomFields: vi.fn((postBody) => postBody)
    }));
  };

  it("updates email when forceUpdate is true", async () => {
    setupMocks();
    
    const result = await updatePlanfixContact({
      contactId: 1,
      email: "new@example.com",
      forceUpdate: true,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    
    // Verify GET request
    const getCall = mockPlanfixRequest.mock.calls[0][0];
    expect(getCall.path).toBe("contact/1");
    expect(getCall.method).toBe("GET");
    // Check for required fields in the fields string
    const fields = (getCall.body as { fields: string }).fields.split(',');
    expect(fields).toContain("id");
    expect(fields).toContain("name");
    expect(fields).toContain("lastname");
    expect(fields).toContain("email");
    expect(fields).toContain("phones");
    // Custom fields should be included as numeric IDs
    expect(fields).toContain("37612");
    
    // Verify UPDATE request
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.path).toBe("contact/1");
    expect(updateCall.body).toEqual(expect.objectContaining({
      email: "new@example.com"
    }));
    
    expect(result.contactId).toBe(1);
    expect(result.url).toBe("https://example.com/contact/1");
  });

  it("does not update email when value is the same and forceUpdate is false", async () => {
    setupMocks();
    
    const result = await updatePlanfixContact({
      contactId: 1,
      email: mockContact.email,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const getCall = mockPlanfixRequest.mock.calls[0][0];
    expect(getCall.path).toBe("contact/1");
    expect(getCall.method).toBe("GET");
    
    // Check for required fields in the fields string
    const fields = (getCall.body as { fields: string }).fields.split(',');
    expect(fields).toContain("id");
    expect(fields).toContain("name");
    expect(fields).toContain("lastname");
    expect(fields).toContain("email");
    expect(fields).toContain("phones");
    // Custom fields should be included as numeric IDs
    expect(fields).toContain("37612");
    
    expect(result.contactId).toBe(1);
  });

  it("updates name and splits it into first and last name", async () => {
    setupMocks({ name: "", lastname: "" });

    const result = await updatePlanfixContact({
      contactId: 1,
      name: "John Smith",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.path).toBe("contact/1");
    expect(updateCall.body).toMatchObject({
      name: "John",
      lastname: "Smith"
    });
    expect(result.contactId).toBe(1);
  });

  it("updates only first name when no last name provided", async () => {
    setupMocks({ name: "", lastname: "" });

    const result = await updatePlanfixContact({
      contactId: 1,
      name: "John",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.path).toBe("contact/1");
    // The implementation only includes the name field when lastname is empty
    expect(updateCall.body).toMatchObject({
      name: "John"
    });
    // Verify lastname is not included in the update
    expect((updateCall.body as any)?.lastname).toBeUndefined();
    expect(result.contactId).toBe(1);
  });

  it("updates telegram username when different", async () => {
    setupMocks({
      customFieldData: [{ field: { id: 1001 }, value: "@old_username" }],
    });

    const result = await updatePlanfixContact({
      contactId: 1,
      telegram: "new_username",
      forceUpdate: true,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.path).toBe("contact/1");
    
    // Check that the customFieldData contains the updated telegram username
    const body = updateCall.body as {
      customFieldData?: Array<{ field: { id: number }; value: string }>;
    };
    const telegramField = body.customFieldData?.find(
      (f) => f.field.id === 1001
    );
    expect(telegramField).toBeDefined();
    expect(telegramField?.value).toBe("@new_username");
    
    expect(result.contactId).toBe(1);
  });

  it("does not update telegram username when same", async () => {
    setupMocks({
      customFieldData: [
        { field: { id: 1001 }, value: "@existing_username" },
        { field: { id: 37612 }, value: "В процессе" }
      ],
    });

    const result = await updatePlanfixContact({
      contactId: 1,
      telegram: "existing_username",
    });

    // Should only make one call (GET) since no updates are needed
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe(1);
  });

  it("normalizes phone numbers by removing non-digit characters", async () => {
    setupMocks({ phones: [] });

    const result = await updatePlanfixContact({
      contactId: 1,
      phone: "+1 (234) 567-8901",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.path).toBe("contact/1");
    
    // Check that the phone number was normalized
    const body = updateCall.body as {
      phones?: Array<{ number: string; type: number }>;
    };
    expect(body.phones).toBeDefined();
    expect(body.phones?.[0]).toEqual({
      number: "12345678901",
      type: 1
    });
    
    expect(result.contactId).toBe(1);
  });

  it("does not add duplicate phone number", async () => {
    const existingPhone = "1234567890";
    setupMocks({
      phones: [{ number: existingPhone, type: 1 }],
      customFieldData: [
        { field: { id: 37612 }, value: "В процессе" }
      ]
    });

    const result = await updatePlanfixContact({
      contactId: 1,
      phone: existingPhone,
    });

    // Should only make one call (GET) since no updates are needed
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
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
