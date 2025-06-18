import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";
import { CreateCommentOutputSchema } from "./planfix_create_comment.js";
import type { z } from "zod";

describe("planfix_create_comment tool", () => {
  it("should create a new comment on a task", async () => {
    const args = {
      taskId: 4984,
      description: "test",
    };

    const result = await runTool("planfix_create_comment", args);

    // Check if the tool execution was marked as valid by runTool wrapper
    expect(
      result.valid,
      `Tool MCP response was invalid. Raw response: ${JSON.stringify(result.parsed)}`,
    ).toBe(true);

    // Check the content returned by the tool itself
    const content = result.content as z.infer<typeof CreateCommentOutputSchema>;
    expect(
      content.error,
      `Tool returned an error: ${content.error}`,
    ).toBeUndefined();

    expect(typeof content.commentId).toBe("number");
    expect(content.commentId).toBeGreaterThan(0);

    if (content.url) {
      expect(content.url).toContain(
        `https://popstas.planfix.com/task/${args.taskId}`,
      );
    }
  }, 30000); // 30 second timeout for API calls
});
