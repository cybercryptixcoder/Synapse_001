import React, { useState } from "react";

type Props = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
};

export const FloatingInput: React.FC<Props> = ({ onSubmit, disabled }) => {
  const [value, setValue] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setValue("");
  };
  return (
    <div className="floating-input">
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Type prediction or reply..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled}>
          Send
        </button>
      </form>
    </div>
  );
};
