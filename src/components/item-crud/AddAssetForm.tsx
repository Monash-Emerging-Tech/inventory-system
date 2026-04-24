import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { NumberInput } from "../inputs/numeric-input";
import { useCallback } from "react";
import { CascadingLocation } from "./CascadingLocation";
import { createItemInput } from "@/server/schema";

interface AddAssetFormProps {
  createItem: (data: z.infer<typeof createItemInput>) => void;
}

export function AddAssetForm({ createItem }: AddAssetFormProps) {
  const form = useForm<z.infer<typeof createItemInput>>({
    resolver: zodResolver(createItemInput),
    defaultValues: {
      name: "",
      cost: 0,
      locationId: "",
      tags: [],
    },
  });

  function onAssetSumbit(values: z.infer<typeof createItemInput>) {
    try {
      createItem(values);
    } catch (err) {
      console.log("Error creating asset:", err);
    }
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
        onSubmit={form.handleSubmit(onAssetSumbit)}
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Asset name" {...field} />
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
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
