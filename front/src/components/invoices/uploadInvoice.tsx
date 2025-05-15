"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { ExtractedInvoiceData, extractInvoiceData } from "@/server/openai";
import { processPdfWithOcr } from "@/server/mistral";
import { format, parse } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarIcon,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateCustomerDialog } from "./customer/createcustomer";
import { CustomerSearch } from "./customer/searchcustomer";

// Types
interface BankDetails {
  bank?: string;
  iban?: string;
  swift?: string;
  account_number?: string;
  routing_number?: string;
  [key: string]: string | undefined;
}

interface NewInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface NewInvoiceInput {
  invoice_number: string;
  invoice_date: Date;
  due_date?: Date | null;
  customer_id: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total: number;
  payment_terms?: string | null;
  payment_method?: string | null;
  bank_details?: BankDetails | null;
  notes?: string | null;
}

interface NewInvoiceData {
  invoice: NewInvoiceInput;
  items: NewInvoiceItem[];
}

// Constants
const PAYMENT_METHODS = [
  "Bank Transfer",
  "Credit Card",
  "PayPal",
  "Cash",
  "Check",
  "Other",
];

const PAYMENT_TERMS = [
  "Net 7",
  "Net 15",
  "Net 30",
  "Net 60",
  "Due on Receipt",
  "End of Month",
];

const API_URL = "http://localhost:3001/api/invoices";

export function CreateInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for the invoice form
  const [invoiceData, setInvoiceData] = useState<NewInvoiceInput>({
    invoice_number: "",
    invoice_date: new Date(),
    due_date: null,
    customer_id: 0,
    subtotal: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    payment_terms: null,
    payment_method: null,
    bank_details: null,
    notes: null,
  });

  // State for invoice items
  const [items, setItems] = useState<NewInvoiceItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);

  // State for bank details
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank: "",
    iban: "",
    swift: "",
    account_number: "",
    routing_number: "",
  });

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("manual");
  
  // Customer dialog states
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerNotFoundId, setCustomerNotFoundId] = useState<number | null>(null);

  // OCR states
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [ocrData, setOcrData] = useState<ExtractedInvoiceData | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>(
    {},
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Calculate subtotal and total whenever items or adjustments change
  useEffect(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );
    const total =
      subtotal -
      (invoiceData.discount || 0) +
      (invoiceData.tax || 0) +
      (invoiceData.shipping || 0);

    setInvoiceData((prev) => ({
      ...prev,
      subtotal,
      total,
    }));
  }, [items, invoiceData.discount, invoiceData.tax, invoiceData.shipping]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setInvoiceData({
      invoice_number: "",
      invoice_date: new Date(),
      due_date: null,
      customer_id: 0,
      subtotal: 0,
      discount: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      payment_terms: null,
      payment_method: null,
      bank_details: null,
      notes: null,
    });
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    setBankDetails({
      bank: "",
      iban: "",
      swift: "",
      account_number: "",
      routing_number: "",
    });
    setShowBankDetails(false);
    setError(null);
    setOcrData(null);
    setOcrConfidence({});
    setSelectedFile(null);
    setActiveTab("manual");
  };

  // Handle input changes for invoice fields
  const handleInvoiceChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    // Handle numeric values
    if (["customer_id", "discount", "tax", "shipping"].includes(name)) {
      setInvoiceData((prev) => ({
        ...prev,
        [name]: value === "" ? 0 : Number.parseFloat(value),
      }));
    } else {
      setInvoiceData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setInvoiceData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle date changes
  const handleDateChange = (name: string, date: Date | undefined) => {
    setInvoiceData((prev) => ({
      ...prev,
      [name]: date || null,
    }));
  };

  // Handle item changes
  const handleItemChange = (
    index: number,
    field: keyof NewInvoiceItem,
    value: string | number,
  ) => {
    const newItems = [...items];

    if (field === "description") {
      newItems[index].description = value as string;
    } else {
      // Convert empty strings to 0 for numeric fields
      newItems[index][field] = value === "" ? 0 : Number(value);
    }

    setItems(newItems);
  };

  // Add new item
  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  // Remove item
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Handle bank details change
  const handleBankDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBankDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    await processFile(file);
  };

  // Separate function for submitting the form without requiring an event
  const submitInvoiceForm = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Basic validation
      if (!invoiceData.invoice_number) {
        throw new Error("Invoice number is required");
      }

      if (invoiceData.customer_id <= 0) {
        throw new Error("Valid customer ID is required");
      }

      // Validate items
      const hasValidItems = items.every(
        (item) => item.description && item.quantity > 0,
      );

      if (!hasValidItems) {
        throw new Error(
          "All items must have a description and quantity greater than 0",
        );
      }

      // Prepare data for submission
      const submissionData: NewInvoiceData = {
        invoice: {
          ...invoiceData,
          bank_details: showBankDetails ? bankDetails : null,
        },
        items: items.map((item) => ({
          ...item,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      // Submit to API
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if it's a customer not found error
        if (
          response.status === 400 && 
          errorData.error && 
          (errorData.error.includes("Customer not found") || 
           errorData.error.includes("customer_id") ||
           errorData.error.includes("is not present in table \"customers\""))
        ) {
          // Store the customer ID that wasn't found
          setCustomerNotFoundId(invoiceData.customer_id);
          
          // Open the customer creation dialog
          setCustomerDialogOpen(true);
          
          // Set a user-friendly error
          throw new Error("Customer not found. Please create this customer first.");
        }
        
        throw new Error(errorData.error || "Failed to create invoice");
      }

      const createdInvoice = await response.json();

      // Show success message
      toast.success(
        `Invoice #${createdInvoice.invoice_number} has been created.`,
      );

      // Close dialog and reset form
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );

      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }, [invoiceData, items, showBankDetails, bankDetails, setCustomerNotFoundId, setCustomerDialogOpen]);

  // Handle customer creation
  const handleCustomerCreated = useCallback((customer: any) => {
    // If we're creating a customer because it wasn't found during invoice creation
    if (customerNotFoundId !== null && customerNotFoundId === invoiceData.customer_id) {
      // The customer now exists, try to create the invoice again with a short delay
      setTimeout(() => {
        submitInvoiceForm();
      }, 500);
    }
    
    // Reset the not found ID
    setCustomerNotFoundId(null);
  }, [customerNotFoundId, invoiceData.customer_id, submitInvoiceForm]);

  // Process the selected file with OCR
  const processFile = async (file: File) => {
    setIsProcessingFile(true);
    setError(null);

    try {
      console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
      // Process the PDF with OCR using Mistral
      const ocrResponse = await processPdfWithOcr(file);

      console.log(ocrResponse, "CCCCCCCCCCCCCCCCCCCCCCCCCCC");

      if (!ocrResponse) {
        throw new Error("Failed to process PDF");
      }

      // Extract structured data from OCR text
      const extractedData = await extractInvoiceData(ocrResponse);

      console.log(extractedData, "ZZZZZZZZZZZZZZZZZZZZZZ");
      setOcrData(extractedData);

      // Generate confidence scores (this would be more sophisticated in a real app)
      const confidence: Record<string, number> = {};
      Object.keys(extractedData).forEach((key) => {
        // Assign random confidence between 0.7 and 1.0 for demo purposes
        // In a real app, this would come from the AI model or be calculated based on validation rules
        confidence[key] = 0.7 + Math.random() * 0.3;
      });
      setOcrConfidence(confidence);

      // Apply the extracted data to the form
      applyExtractedData(extractedData);

      // Switch to the review tab
      setActiveTab("review");

      toast.success("Invoice data extracted successfully");
    } catch (err) {
      console.error("Error processing file:", err);
      setError(
        err instanceof Error ? err.message : "Failed to process the PDF file",
      );
      toast.error("Failed to process the PDF file");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Apply extracted data to the form
  const applyExtractedData = (data: ExtractedInvoiceData) => {
    // Parse dates
    let invoiceDate = new Date();
    let dueDate = null;

    try {
      if (data.invoice_date) {
        invoiceDate = parse(data.invoice_date, "yyyy-MM-dd", new Date());
      }

      if (data.due_date) {
        dueDate = parse(data.due_date, "yyyy-MM-dd", new Date());
      }
    } catch (e) {
      console.error("Error parsing dates:", e);
    }

    // Update invoice data
    setInvoiceData({
      invoice_number: data.invoice_number || "",
      invoice_date: invoiceDate,
      due_date: dueDate,
      customer_id: data.customer_id || 0,
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      tax: data.tax || 0,
      shipping: data.shipping || 0,
      total: data.total || 0,
      payment_terms: data.payment_terms || null,
      payment_method: data.payment_method || null,
      notes: data.notes || null,
      bank_details: null,
    });

    // Update items
    if (data.items && data.items.length > 0) {
      setItems(
        data.items.map((item) => ({
          description: item.description || "",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
        })),
      );
    }

    // Update bank details if present
    if (data.bank_details) {
      setBankDetails({
        bank: data.bank_details.bank || "",
        iban: data.bank_details.iban || "",
        swift: data.bank_details.swift || "",
        account_number: data.bank_details.account_number || "",
        routing_number: data.bank_details.routing_number || "",
      });
      setShowBankDetails(true);
    }
  };

  // Get confidence class based on confidence score
  const getConfidenceClass = (field: string) => {
    const score = ocrConfidence[field] || 0;
    if (score > 0.9) return "bg-green-50 border-green-200";
    if (score > 0.75) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  // Handle form submission from the UI form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitInvoiceForm();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New Invoice</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[750px] lg:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Fill out the form manually or upload an invoice PDF to extract data
            automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload PDF</TabsTrigger>
            <TabsTrigger value="review" disabled={!ocrData}>
              Review Extracted Data
            </TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Invoice PDF</CardTitle>
                <CardDescription>
                  Upload a PDF invoice to automatically extract data using OCR.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center space-y-4">
                      <FileText className="h-12 w-12 text-blue-500" />
                      <div className="text-center">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>

                      {isProcessingFile ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change File
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-4">
                      <Upload className="h-12 w-12 text-gray-400" />
                      <div className="text-center">
                        <p className="font-medium">
                          Drag and drop or click to upload
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports PDF files up to 10MB
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingFile}
                      >
                        Select File
                      </Button>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setActiveTab(ocrData ? "review" : "manual")}
                  disabled={isProcessingFile || (!ocrData && !selectedFile)}
                >
                  {ocrData
                    ? "Review Extracted Data"
                    : "Continue to Manual Entry"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Review Extracted Data</CardTitle>
                <CardDescription>
                  Review and correct the data extracted from your invoice PDF.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="review_invoice_number"
                        className="text-sm font-medium"
                      >
                        Invoice Number
                      </Label>
                      <Input
                        id="review_invoice_number"
                        value={invoiceData.invoice_number}
                        onChange={(e) =>
                          setInvoiceData((prev) => ({
                            ...prev,
                            invoice_number: e.target.value,
                          }))
                        }
                        className={getConfidenceClass("invoice_number")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="review_customer_id"
                        className="text-sm font-medium"
                      >
                        Customer
                      </Label>
                      <CustomerSearch 
                        value={invoiceData.customer_id} 
                        onChange={(id:number) => setInvoiceData(prev => ({ ...prev, customer_id: id }))}
                        onCreateNew={() => setCustomerDialogOpen(true)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Invoice Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${getConfidenceClass("invoice_date")}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {invoiceData.invoice_date
                              ? format(invoiceData.invoice_date, "PPP")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={invoiceData.invoice_date}
                            onSelect={(date) =>
                              handleDateChange("invoice_date", date)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${getConfidenceClass("due_date")}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {invoiceData.due_date
                              ? format(invoiceData.due_date, "PPP")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={invoiceData.due_date || undefined}
                            onSelect={(date) =>
                              handleDateChange("due_date", date)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Invoice Items</h3>

                    <div className="space-y-4">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className={`grid grid-cols-12 gap-2 items-center p-3 rounded-md ${getConfidenceClass("items")}`}
                        >
                          <div className="col-span-12 md:col-span-6">
                            <Label className="md:hidden text-sm">
                              Description
                            </Label>
                            <Input
                              placeholder="Item description"
                              value={item.description}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="col-span-5 md:col-span-2">
                            <Label className="md:hidden text-sm">
                              Quantity
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="col-span-5 md:col-span-3">
                            <Label className="md:hidden text-sm">
                              Unit Price
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Price"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "unit_price",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1 flex justify-end items-end md:items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              disabled={items.length <= 1}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="review_discount"
                        className="text-sm font-medium"
                      >
                        Discount
                      </Label>
                      <Input
                        id="review_discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={invoiceData.discount || ""}
                        onChange={(e) =>
                          setInvoiceData((prev) => ({
                            ...prev,
                            discount:
                              e.target.value === ""
                                ? 0
                                : Number.parseFloat(e.target.value),
                          }))
                        }
                        className={getConfidenceClass("discount")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="review_tax"
                        className="text-sm font-medium"
                      >
                        Tax
                      </Label>
                      <Input
                        id="review_tax"
                        type="number"
                        min="0"
                        step="0.01"
                        value={invoiceData.tax || ""}
                        onChange={(e) =>
                          setInvoiceData((prev) => ({
                            ...prev,
                            tax:
                              e.target.value === ""
                                ? 0
                                : Number.parseFloat(e.target.value),
                          }))
                        }
                        className={getConfidenceClass("tax")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="review_shipping"
                        className="text-sm font-medium"
                      >
                        Shipping
                      </Label>
                      <Input
                        id="review_shipping"
                        type="number"
                        min="0"
                        step="0.01"
                        value={invoiceData.shipping || ""}
                        onChange={(e) =>
                          setInvoiceData((prev) => ({
                            ...prev,
                            shipping:
                              e.target.value === ""
                                ? 0
                                : Number.parseFloat(e.target.value),
                          }))
                        }
                        className={getConfidenceClass("shipping")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="review_total"
                        className="text-sm font-medium"
                      >
                        Total
                      </Label>
                      <div
                        className={`h-10 px-3 py-2 rounded-md border flex items-center ${getConfidenceClass("total")}`}
                      >
                        ${invoiceData.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("upload")}
                >
                  Back to Upload
                </Button>
                <Button onClick={() => setActiveTab("manual")}>
                  Continue to Edit
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Basic Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="invoice_number"
                    className="text-sm font-medium"
                  >
                    Invoice Number *
                  </Label>
                  <Input
                    id="invoice_number"
                    name="invoice_number"
                    value={invoiceData.invoice_number}
                    onChange={handleInvoiceChange}
                    placeholder="INV-2025-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id" className="text-sm font-medium">
                    Customer *
                  </Label>
                  <CustomerSearch 
                    value={invoiceData.customer_id} 
                    onChange={(id:number) => setInvoiceData(prev => ({ ...prev, customer_id: id }))}
                    onCreateNew={() => setCustomerDialogOpen(true)}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Invoice Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {invoiceData.invoice_date
                          ? format(invoiceData.invoice_date, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={invoiceData.invoice_date}
                        onSelect={(date) =>
                          handleDateChange("invoice_date", date)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {invoiceData.due_date
                          ? format(invoiceData.due_date, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={invoiceData.due_date || undefined}
                        onSelect={(date) => handleDateChange("due_date", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Payment Terms & Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Terms</Label>
                  <Select
                    onValueChange={(value) =>
                      handleSelectChange("payment_terms", value)
                    }
                    value={invoiceData.payment_terms || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <Select
                    onValueChange={(value) =>
                      handleSelectChange("payment_method", value)
                    }
                    value={invoiceData.payment_method || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Invoice Items *</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Header row for items table */}
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 hidden md:grid">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2">Quantity</div>
                    <div className="col-span-3">Unit Price</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Item rows */}
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 md:col-span-6">
                        <Label className="md:hidden text-sm">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          required
                        />
                      </div>
                      <div className="col-span-5 md:col-span-2">
                        <Label className="md:hidden text-sm">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-span-5 md:col-span-3">
                        <Label className="md:hidden text-sm">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "unit_price",
                              e.target.value,
                            )
                          }
                          required
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end items-end md:items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Invoice Totals</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount" className="text-sm font-medium">
                      Discount
                    </Label>
                    <Input
                      id="discount"
                      name="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceData.discount || ""}
                      onChange={handleInvoiceChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax" className="text-sm font-medium">
                      Tax
                    </Label>
                    <Input
                      id="tax"
                      name="tax"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceData.tax || ""}
                      onChange={handleInvoiceChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping" className="text-sm font-medium">
                      Shipping
                    </Label>
                    <Input
                      id="shipping"
                      name="shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceData.shipping || ""}
                      onChange={handleInvoiceChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="total" className="text-sm font-medium">
                      Total
                    </Label>
                    <div className="h-10 px-3 py-2 rounded-md bg-gray-50 border flex items-center">
                      ${invoiceData.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show-bank-details"
                    checked={showBankDetails}
                    onChange={() => setShowBankDetails(!showBankDetails)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label
                    htmlFor="show-bank-details"
                    className="text-sm font-medium"
                  >
                    Include Bank Details
                  </Label>
                </div>

                {showBankDetails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="bank" className="text-sm font-medium">
                        Bank Name
                      </Label>
                      <Input
                        id="bank"
                        name="bank"
                        value={bankDetails.bank || ""}
                        onChange={handleBankDetailChange}
                        placeholder="Bank name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="account_number"
                        className="text-sm font-medium"
                      >
                        Account Number
                      </Label>
                      <Input
                        id="account_number"
                        name="account_number"
                        value={bankDetails.account_number || ""}
                        onChange={handleBankDetailChange}
                        placeholder="Account number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="routing_number"
                        className="text-sm font-medium"
                      >
                        Routing Number
                      </Label>
                      <Input
                        id="routing_number"
                        name="routing_number"
                        value={bankDetails.routing_number || ""}
                        onChange={handleBankDetailChange}
                        placeholder="Routing number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="swift" className="text-sm font-medium">
                        SWIFT/BIC
                      </Label>
                      <Input
                        id="swift"
                        name="swift"
                        value={bankDetails.swift || ""}
                        onChange={handleBankDetailChange}
                        placeholder="SWIFT code"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <Label htmlFor="iban" className="text-sm font-medium">
                        IBAN
                      </Label>
                      <Input
                        id="iban"
                        name="iban"
                        value={bankDetails.iban || ""}
                        onChange={handleBankDetailChange}
                        placeholder="IBAN"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={invoiceData.notes || ""}
                  onChange={handleInvoiceChange}
                  placeholder="Additional notes or payment instructions"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>

        {/* Add the customer creation dialog */}
        <CreateCustomerDialog
          open={customerDialogOpen}
          onOpenChange={setCustomerDialogOpen}
          onCustomerCreated={handleCustomerCreated}
          initialData={{ 
            // Pre-fill with any customer info you might have
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
