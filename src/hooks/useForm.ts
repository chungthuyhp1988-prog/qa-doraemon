import { useForm as useReactHookForm, type UseFormProps as ReactUseFormProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type z } from 'zod';
import { useState } from 'react';
import { toast } from '../stores/toastStore';

export interface UseFormProps<TSchema extends z.ZodTypeAny> 
  extends Omit<ReactUseFormProps<z.output<TSchema>>, 'resolver'> {
  schema: TSchema;
  onSubmit: (values: z.output<TSchema>) => void | Promise<void>;
  successMessage?: string;
  errorMessage?: string;
}

export function useForm<TSchema extends z.ZodTypeAny>({
  schema,
  onSubmit,
  successMessage,
  errorMessage = 'Đã xảy ra lỗi. Vui lòng kiểm tra lại thông tin.',
  ...formProps
}: UseFormProps<TSchema>) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useReactHookForm<z.output<TSchema>>({
    ...formProps,
    // Zod v4 + react-hook-form resolver type mismatch requires assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
  });

  const handleFormSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      toast.error(errorMessage, message);
    } finally {
      setIsSubmitting(false);
    }
  });

  return {
    ...form,
    isSubmitting,
    handleFormSubmit,
  };
}
