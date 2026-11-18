import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

function BoardHarness() {
  const [board, setBoard] = useState(initialData);
  return <KanbanBoard board={board} onChange={setBoard} />;
}

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<BoardHarness />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<BoardHarness />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.tab();
    expect(within(column).getByLabelText("Column title")).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<BoardHarness />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: "Delete New card",
      exact: true,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits the title and details of an existing card", async () => {
    render(<BoardHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Align roadmap themes", exact: true }));
    const title = screen.getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated roadmap");
    const details = screen.getByLabelText("Card details");
    await userEvent.clear(details);
    await userEvent.type(details, "Updated notes");
    await userEvent.click(screen.getByRole("button", { name: "Save card", exact: true }));
    expect(screen.getByText("Updated roadmap")).toBeInTheDocument();
    expect(screen.getByText("Updated notes")).toBeInTheDocument();
  });
});
