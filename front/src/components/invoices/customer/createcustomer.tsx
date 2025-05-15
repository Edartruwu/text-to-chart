"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface NewCustomerInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
}

interface Customer {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customer: Customer) => void;
  initialData?: Partial<NewCustomerInput>;
}

const API_URL = "http://localhost:3001/api/customers";

export function CreateCustomerDialog({
  open,
  onOpenChange,
  onCustomerCreated,
  initialData = {},
}: CreateCustomerDialogProps) {
  const [customerData, setCustomerData] = useState<NewCustomerInput>({
    name: initialData.name || "",
    address: initialData.address || "",
    phone: initialData.phone || "",
    email: initialData.email || "",
    tax_id: initialData.tax_id || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCustomerData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setCustomerData({
      name: "",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Basic validation
      if (!customerData.name.trim()) {
        throw new Error("Customer name is required");
      }

      // Submit to API
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create customer");
      }

      const createdCustomer = await response.json();

      // Show success message
      toast.success(`Customer "${createdCustomer.name}" has been created.`);

      // Call the callback if provided
      if (onCustomerCreated) {
        onCustomerCreated(createdCustomer);
      }

      // Close dialog
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      toast.error(
        err instanceof Error ? err.message : "Failed to create customer"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Add a new customer to your system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Customer Name *
            </Label>
            <Input
              id="name"
              name="name"
              value={customerData.name}
              onChange={handleInputChange}
              placeholder="Customer or company name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={customerData.email}
              onChange={handleInputChange}
              placeholder="contact@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone
            </Label>
            <Input
              id="phone"
              name="phone"
              value={customerData.phone}
              onChange={handleInputChange}
              placeholder="+1 (123) 456-7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">
              Address
            </Label>
            <Textarea
              id="address"
              name="address"
              value={customerData.address}
              onChange={handleInputChange}
              placeholder="Full address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_id" className="text-sm font-medium">
              Tax ID / VAT Number
            </Label>
            <Input
              id="tax_id"
              name="tax_id"
              value={customerData.tax_id}
              onChange={handleInputChange}
              placeholder="Tax identification number"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
