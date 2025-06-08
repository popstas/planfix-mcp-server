import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../helpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers.js')>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
  };
});

import { planfixRequest } from '../helpers.js';
import { updatePlanfixContact } from './planfix_update_contact.js';

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe('planfix_update_contact tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates email when forceUpdate is true', async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      id: 1,
      name: 'Old',
      email: 'old@example.com',
      phones: [],
      customFieldData: [],
    });
    mockPlanfixRequest.mockResolvedValueOnce({});

    const result = await updatePlanfixContact({
      contactId: 1,
      email: 'new@example.com',
      forceUpdate: true,
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(mockPlanfixRequest.mock.calls[1][0]).toBe('contact/1');
    expect(mockPlanfixRequest.mock.calls[1][1]).toEqual({ email: 'new@example.com' });
    expect(result.contactId).toBe(1);
  });
});
