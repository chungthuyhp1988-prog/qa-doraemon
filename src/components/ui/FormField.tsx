import React from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

export interface FormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  render: (props: {
    field: {
      onChange: (...event: any[]) => void;
      onBlur: () => void;
      value: any;
      name: string;
      ref: React.Ref<any>;
    };
    fieldState: {
      invalid: boolean;
      isTouched: boolean;
      isDirty: boolean;
      error?: any;
    };
  }) => React.ReactElement;
  className?: string;
}

export function FormField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  render,
  className,
}: FormFieldProps<TFieldValues>) {
  return (
    <div className={className}>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1">
            {render({ field, fieldState })}
          </div>
        )}
      />
    </div>
  );
}
