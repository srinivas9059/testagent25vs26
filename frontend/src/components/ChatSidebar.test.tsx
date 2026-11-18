import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar, clearChatHistory } from "@/components/ChatSidebar";
import { ApiError, type ChatReply, type Message } from "@/lib/api";

beforeEach(clearChatHistory);

it("shows a pending request, displays the reply, and sends history on a follow-up", async () => {
  let complete!: (reply: ChatReply) => void;
  const calls: { message: string; history: Message[] }[] = [];
  const onSend = (message: string, history: Message[]) => {
    calls.push({ message, history });
    return new Promise<ChatReply>((resolve) => { complete = resolve; });
  };
  const user = userEvent.setup();
  render(<ChatSidebar disabled={false} onSend={onSend} />);
  await user.type(screen.getByRole("textbox", { name: "Message" }), "What's in Review?");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(screen.getByText("Assistant is working…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  await act(async () => { complete({ reply: "QA is in Review.", boardUpdated: false }); });
  expect(within(screen.getByRole("log")).getByText("QA is in Review.")).toBeInTheDocument();
  await user.type(screen.getByRole("textbox", { name: "Message" }), "Move it to Done");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(calls[1].history).toEqual([
    { role: "user", content: "What's in Review?" },
    { role: "assistant", content: "QA is in Review." },
  ]);
  await act(async () => { complete({ reply: "Moved QA.", boardUpdated: true }); });
  expect(screen.getByText("Board updated.")).toBeInTheDocument();
});

it("reports API errors and keeps the draft available for retry", async () => {
  const user = userEvent.setup();
  render(<ChatSidebar disabled={false} onSend={async () => {
    throw new ApiError(502, "No board changes were saved.");
  }} />);
  const input = screen.getByRole("textbox", { name: "Message" });
  await user.type(input, "Move the QA card");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(screen.getByRole("alert")).toHaveTextContent("No board changes were saved.");
  expect(input).toHaveValue("Move the QA card");
  expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
});
