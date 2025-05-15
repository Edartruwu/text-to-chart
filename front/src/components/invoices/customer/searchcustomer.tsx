"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: number;
  name: string;
}

interface CustomerSearchProps {
  value: number;
  onChange: (customerId: number) => void;
  onCreateNew: () => void;
}

export function CustomerSearch({ value, onChange, onCreateNew }: CustomerSearchProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
console.log(error)
  // Fetch customers on component mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("http://localhost:3001/api/customers");
        
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }

        const data = await response.json();
        setCustomers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        toast.error("Failed to load customers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  return (
    <div className="flex space-x-2">
      <div className="flex-grow">
        <Select 
          value={value ? String(value) : ""} 
          onValueChange={(val) => onChange(Number(val))}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.length === 0 && !isLoading && (
              <SelectItem value="empty" disabled>
                No customers found
              </SelectItem>
            )}
            
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={String(customer.id)}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Button 
        variant="outline" 
        size="icon" 
        onClick={onCreateNew}
        title="Create new customer"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
