import z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NumberInput } from "../inputs/numeric-input";
import { useCallback } from "react";
import { CascadingLocation } from "./CascadingLocation";
import { createItemInput } from "@/server/schema";

interface AddConsumableFormProps {
  createItem: (data: z.infer<typeof createItemInput>) => void;
}

export function AddConsumableForm({ createItem }: AddConsumableFormProps) {
  const form = useForm<z.infer<typeof createItemInput>>({
    resolver: zodResolver(createItemInput),
    defaultValues: {
      name: "",
      cost: 0,
      locationId: "",
      tags: [],
      consumable: {
        total: 0,
        available: 0,
      },
    },
  });

  function onConsumableSubmit(values: z.infer<typeof createItemInput>) {
    createItem(values);
  }

  const handleLocationSelect = useCallback(
    (locationId: string | null) => {
      if (locationId) {
        form.setValue("locationId", locationId ?? "", {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    },
    [form],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onConsumableSubmit)}
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Consumable name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Location</FormLabel>
          <CascadingLocation onLocationSelect={handleLocationSelect} />
          {form.formState.errors.locationId && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.locationId.message}
            </p>
          )}
        </FormItem>

        <div className="grid grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="consumable.total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total amount</FormLabel>
                <FormControl>
                  <NumberInput
                    min={1}
                    value={field.value}
                    onValueChange={(value) => {
                      form.setValue("consumable.total", value ?? 0, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      form.setValue("consumable.available", value ?? 0, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    thousandSeparator=","
                    className=""
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost</FormLabel>
                <FormControl>
                  <NumberInput
                    min={1}
                    value={field.value}
                    onValueChange={field.onChange}
                    thousandSeparator=","
                    className=""
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
