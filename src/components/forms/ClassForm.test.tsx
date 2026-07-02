import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClassForm } from './ClassForm';
import React from 'react';

// Mock the TanStack react-query and external hooks/stores
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { school_id: '00000000-0000-0000-0000-000000000001' } };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../stores/appStore', () => ({
  useAppStore: (selector?: any) => {
    const state = { selectedAcademicYearId: '2025-2026-id' };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../ui', () => {
  const React = require('react');
  const Input = React.forwardRef(({ label, error, ...props }: any, ref: any) => (
    <div>
      <label>{label}</label>
      <input ref={ref} {...props} />
      {error && <span role="alert">{error}</span>}
    </div>
  ));
  Input.displayName = 'Input';

  const Select = React.forwardRef(({ label, error, children, ...props }: any, ref: any) => (
    <div>
      <label>{label}</label>
      <select ref={ref} {...props}>
        {children}
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  ));
  Select.displayName = 'Select';

  const Textarea = React.forwardRef(({ label, error, ...props }: any, ref: any) => (
    <div>
      <label>{label}</label>
      <textarea ref={ref} {...props} />
      {error && <span role="alert">{error}</span>}
    </div>
  ));
  Textarea.displayName = 'Textarea';

  const Button = ({ children, ...props }: any) => <button {...props}>{children}</button>;
  const Switch = ({ checked, onChange, label }: any) => (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );

  return {
    Input,
    Select,
    Textarea,
    Button,
    Switch,
    useSlidePanel: () => ({ closePanel: vi.fn() }),
  };
});

describe('ClassForm Integration Test', () => {
  const mockTeachers = [
    { id: 't1', full_name: 'Cô Nguyễn Thị A' },
    { id: 't2', full_name: 'Cô Trần Thị B' },
  ];

  it('should render the ClassForm correctly', () => {
    render(<ClassForm teachersList={mockTeachers} />);
    
    expect(screen.getByText('Tên lớp học')).toBeInTheDocument();
    expect(screen.getByText('Khối lớp')).toBeInTheDocument();
    expect(screen.getByText('Sức chứa tối đa (Trẻ)')).toBeInTheDocument();
  });

  it('should switch to custom class name mode and validate empty fields', async () => {
    render(<ClassForm teachersList={mockTeachers} />);

    // Get the select elements. There are multiple selects (name, grade_level).
    // The first one is for class name.
    const selects = screen.getAllByRole('combobox');
    const nameSelect = selects[0];

    // Change value of name select to custom
    fireEvent.change(nameSelect, { target: { value: 'custom' } });

    // Click submit button "Tạo mới"
    const submitButton = screen.getByText('Tạo mới');
    fireEvent.click(submitButton);

    // Verify errors are displayed
    await waitFor(() => {
      expect(screen.getByText('Tên lớp là bắt buộc')).toBeInTheDocument();
      expect(screen.getByText('Số phòng học là bắt buộc')).toBeInTheDocument();
    });
  });
});
