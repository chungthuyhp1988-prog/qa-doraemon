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
    resolver: zodResolver(schema) as any,
  });

  const handleFormSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(errorMessage, err.message || '');
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
