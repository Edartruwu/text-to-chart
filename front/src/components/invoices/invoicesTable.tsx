"use client";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Loader2,
  FileDown,
  Eye,
} from "lucide-react";
import { CreateInvoiceDialog } from "./uploadInvoice";

// Types imported from our API
interface BankDetails {
  bank?: string;
  iban?: string;
  swift?: string;
  account_number?: string;
  routing_number?: string;
  [key: string]: string | undefined;
}

interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: Date;
}

interface Customer {
  id: number;
  name: string;
  email: string | null;
  tax_id: string | null;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date | null;
  customer_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  payment_terms: string | null;
  payment_method: string | null;
  bank_details: BankDetails | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

interface CompleteInvoice extends InvoiceWithCustomer {
  items: InvoiceItem[];
}

interface SortSpec {
  field: string;
  direction: "asc" | "desc";
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

interface FilterState {
  invoiceNumber?: string;
  customerName?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  totalMin?: string;
  totalMax?: string;
  paymentMethod?: string;
  searchTerm?: string;
}

// Props for our table component
interface InvoiceTableProps {
  includeCustomer?: boolean;
  includeItems?: boolean;
  defaultPageSize?: number;
  defaultSort?: SortSpec[];
  defaultFilter?: FilterState;
}

const BASE_URL = "http://localhost:3000";

export default function InvoiceTable({
  includeCustomer = true,
  includeItems = false,
  defaultPageSize = 10,
  defaultSort = [{ field: "invoice_date", direction: "desc" }],
  defaultFilter = {},
}: InvoiceTableProps) {
  // State for pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // State for sorting
  const [sort, setSort] = useState<SortSpec[]>(defaultSort);

  // State for filtering
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [filterOpen, setFilterOpen] = useState(false);

  // State for API data
  const [invoices, setInvoices] = useState<
    (Invoice | InvoiceWithCustomer | CompleteInvoice)[]
  >([]);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>({
    page: 1,
    pageSize: defaultPageSize,
    totalItems: 0,
    totalPages: 0,
  });

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handler for sorting
  const handleSort = (field: string) => {
    setSort((prevSort) => {
      // Find if the field is already being sorted
      const existingIndex = prevSort.findIndex((item) => item.field === field);

      // If the field is already being sorted, toggle the direction
      if (existingIndex >= 0) {
        const existing = prevSort[existingIndex];
        const newDirection = existing.direction === "asc" ? "desc" : "asc";

        // Create a new array with the updated sort
        const newSort = [...prevSort];
        newSort[existingIndex] = { ...existing, direction: newDirection };
        return newSort;
      }

      // Otherwise, add a new sort for this field
      return [...prevSort, { field, direction: "asc" }];
    });
  };

  // Function to build the query string
  const buildQueryString = () => {
    const params = new URLSearchParams();

    // Pagination
    params.append("page", page.toString());
    params.append("pageSize", pageSize.toString());

    // Include options
    if (includeCustomer) params.append("includeCustomer", "true");
    if (includeItems) params.append("includeItems", "true");

    // Sorting
    if (sort.length > 0) {
      params.append("sort", JSON.stringify(sort));
    }

    // Filtering
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    return params.toString();
  };

  // Function to fetch invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryString = buildQueryString();
      const response = await fetch(`${BASE_URL}/api/invoices?${queryString}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch invoices");
      }

      const data: PaginatedResponse<
        Invoice | InvoiceWithCustomer | CompleteInvoice
      > = await response.json();

      // Parse dates - API returns date strings but we want Date objects
      const parsedData = data.data.map((invoice) => ({
        ...invoice,
        invoice_date: new Date(invoice.invoice_date),
        due_date: invoice.due_date ? new Date(invoice.due_date) : null,
        created_at: new Date(invoice.created_at),
        updated_at: new Date(invoice.updated_at),
      }));

      setInvoices(parsedData);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoices when pagination, sorting, or filtering changes
  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, sort, filter, includeCustomer, includeItems]);

  // Function to handle filter changes
  const handleFilterChange = (name: keyof FilterState, value: string) => {
    setFilter((prev) => ({
      ...prev,
      [name]: value || undefined,
    }));
  };

  // Function to clear all filters
  const clearFilters = () => {
    setFilter({});
    setPage(1);
  };

  // Function to handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already handled by the filter state changes
    setPage(1);
  };

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filter).some(
      (value) => value !== undefined && value !== "",
    );
  }, [filter]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return format(date, "MMM d, yyyy");
  };

  // Calculate due status
  const getDueStatus = (invoice: Invoice) => {
    if (!invoice.due_date) return null;

    const now = new Date();
    const dueDate = new Date(invoice.due_date);

    if (dueDate < now) {
      return "overdue";
    } else {
      const diffTime = Math.abs(dueDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) {
        return "due-soon";
      }
    }

    return "on-time";
  };

  return (
    <div className="w-full space-y-4">
      {/* Header and controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">Invoices</h2>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filter.searchTerm || ""}
              onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            >
              <Search size={20} />
            </button>
          </form>

          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1 px-3 py-2 rounded-md ${
              hasActiveFilters
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
            aria-label="Toggle filters"
          >
            <Filter size={18} />
            <span className="hidden md:inline">Filters</span>
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-700 rounded-full">
                {Object.values(filter).filter(Boolean).length}
              </span>
            )}
          </button>

          <CreateInvoiceDialog />
        </div>
      </div>

      {/* Filters panel */}
      {filterOpen && (
        <div className="p-4 bg-gray-50 rounded-md border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Filters</h3>
            <div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-900 mr-4"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setFilterOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.invoiceNumber || ""}
                onChange={(e) =>
                  handleFilterChange("invoiceNumber", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.customerName || ""}
                onChange={(e) =>
                  handleFilterChange("customerName", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.paymentMethod || ""}
                onChange={(e) =>
                  handleFilterChange("paymentMethod", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date (From)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.invoiceDateFrom || ""}
                onChange={(e) =>
                  handleFilterChange("invoiceDateFrom", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date (To)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.invoiceDateTo || ""}
                onChange={(e) =>
                  handleFilterChange("invoiceDateTo", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (From)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.dueDateFrom || ""}
                onChange={(e) =>
                  handleFilterChange("dueDateFrom", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (To)
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.dueDateTo || ""}
                onChange={(e) =>
                  handleFilterChange("dueDateTo", e.target.value)
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Total
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.totalMin || ""}
                onChange={(e) => handleFilterChange("totalMin", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Total
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md"
                value={filter.totalMax || ""}
                onChange={(e) => handleFilterChange("totalMax", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setPage(1);
                setFilterOpen(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 text-red-700 bg-red-100 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("invoice_number")}
              >
                <div className="flex items-center space-x-1">
                  <span>Invoice #</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              {includeCustomer && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("customer_name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Customer</span>
                    <ArrowUpDown size={14} />
                  </div>
                </th>
              )}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("invoice_date")}
              >
                <div className="flex items-center space-x-1">
                  <span>Date</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("due_date")}
              >
                <div className="flex items-center space-x-1">
                  <span>Due Date</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("total")}
              >
                <div className="flex items-center space-x-1">
                  <span>Total</span>
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={includeCustomer ? 6 : 5}
                  className="px-6 py-12 text-center"
                >
                  <div className="flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={includeCustomer ? 6 : 5}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const dueStatus = getDueStatus(invoice);

                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>

                    {includeCustomer && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {"customer" in invoice
                          ? invoice.customer.name
                          : `Customer #${invoice.customer_id}`}
                      </td>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.invoice_date)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {invoice.due_date ? (
                        <span
                          className={`${
                            dueStatus === "overdue"
                              ? "text-red-600 bg-red-50 border-red-200"
                              : dueStatus === "due-soon"
                                ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                                : "text-green-600 bg-green-50 border-green-200"
                          } py-1 px-2 rounded-full text-xs border`}
                        >
                          {formatDate(invoice.due_date)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          title="View"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          href={`/invoices/${invoice.id}/download`}
                          className="text-green-600 hover:text-green-900"
                          title="Download"
                        >
                          <FileDown size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex-1 text-sm text-gray-700">
          Showing{" "}
          <span className="font-medium">
            {invoices.length > 0 ? (page - 1) * pageSize + 1 : 0}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {Math.min(page * pageSize, pagination.totalItems)}
          </span>{" "}
          of <span className="font-medium">{pagination.totalItems}</span>{" "}
          results
        </div>

        <div className="flex items-center space-x-2">
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>

          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className={`p-1 rounded ${
              page === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm text-gray-700">
            Page {page} of {pagination.totalPages}
          </span>

          <button
            onClick={() =>
              setPage((prev) => Math.min(prev + 1, pagination.totalPages))
            }
            disabled={page === pagination.totalPages}
            className={`p-1 rounded ${
              page === pagination.totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
