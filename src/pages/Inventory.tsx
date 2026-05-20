// src/pages/Inventory.tsx

import React, {
  useState,
  useMemo,
  useEffect,
} from 'react';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import * as z from 'zod';

import { motion } from 'framer-motion';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Badge } from '@/components/ui/badge';

import { Textarea } from '@/components/ui/textarea';

import { Switch } from '@/components/ui/switch';

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { Skeleton } from '@/components/ui/skeleton';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Plus,
  Edit,
  Trash2,
  Search,
  Package,
  Box,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from 'lucide-react';

import { Navbar } from '@/components/Navbar';

import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/contexts/AuthContext';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

interface InventoryItem {
  id: string;

  shop_id: string;

  created_by?: string;

  item_name: string;

  category: string;

  quantity: number;

  unit_price: number;

  cost_price: number;

  low_stock_threshold: number;

  is_available: boolean;

  image_url?: string | null;

  description?: string | null;

  brand?: string | null;
}

const productSchema = z.object({
  item_name: z.string().min(2),

  category: z.string().min(2),

  quantity: z.coerce.number().min(0),

  unit_price: z.coerce.number().min(0),

  cost_price: z.coerce.number().min(0),

  low_stock_threshold:
    z.coerce.number().min(0),

  is_available:
    z.boolean().default(true),

  brand:
    z.string().optional().nullable(),

  description:
    z.string().optional().nullable(),

  image_url: z
    .string()
    .url()
    .optional()
    .or(z.literal('')),
});

type ProductFormData =
  z.infer<typeof productSchema>;

const ProductForm = ({
  onSubmit,
  initialData,
  isSubmitting,
}: {
  onSubmit: (
    data: ProductFormData
  ) => void;

  initialData?: Partial<ProductFormData>;

  isSubmitting: boolean;
}) => {
  const form =
    useForm<ProductFormData>({
      resolver:
        zodResolver(productSchema),

      defaultValues:
        initialData || {
          item_name: '',
          category: '',
          quantity: 0,
          unit_price: 0,
          cost_price: 0,
          low_stock_threshold: 10,
          is_available: true,
          brand: '',
          description: '',
          image_url: '',
        },
    });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          onSubmit
        )}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="item_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Product Name
                </FormLabel>

                <FormControl>
                  <Input
                    placeholder="Fresh Banana"
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Category
                </FormLabel>

                <FormControl>
                  <Input
                    placeholder="Fruits"
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Brand
                </FormLabel>

                <FormControl>
                  <Input
                    placeholder="Optional"
                    {...field}
                    value={
                      field.value ?? ''
                    }
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description
                </FormLabel>

                <FormControl>
                  <Textarea
                    placeholder="Description..."
                    {...field}
                    value={
                      field.value ?? ''
                    }
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Quantity
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="low_stock_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Low Stock Alert
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cost_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Cost Price
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Selling Price
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Image URL
                </FormLabel>

                <FormControl>
                  <Input
                    placeholder="https://..."
                    {...field}
                    value={
                      field.value ?? ''
                    }
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_available"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between border rounded-lg p-4">
                <FormLabel>
                  Product Available
                </FormLabel>

                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={
                      field.onChange
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="col-span-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting
              ? 'Saving...'
              : 'Save Product'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export default function Inventory() {
  const { toast } = useToast();

  const { user } = useAuth();

  const queryClient =
    useQueryClient();

  const [profile, setProfile] =
    useState<any>(null);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('all');

  const [activeTab, setActiveTab] =
    useState('all');

  const [dialogState, setDialogState] =
    useState<{
      mode: 'add' | 'edit' | null;

      item: InventoryItem | null;
    }>({
      mode: null,
      item: null,
    });

  useEffect(() => {
    const fetchProfile =
      async () => {
        if (!user?.id) return;

        const { data } =
          await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        setProfile(data);
      };

    fetchProfile();
  }, [user]);

  const {
    data: inventoryItems = [],
    isLoading,
  } = useQuery({
    queryKey: [
      'inventory',
      profile?.shop_id,
    ],

    queryFn: async () => {
      if (!profile?.shop_id)
        return [];

      const { data, error } =
        await supabase
          .from('inventory')
          .select('*')
          .eq(
            'shop_id',
            profile.shop_id
          )
          .order('item_name');

      if (error) throw error;

      return data as InventoryItem[];
    },

    enabled: !!profile?.shop_id,
  });

  const mutation = useMutation({
    mutationFn: async (
      payload: ProductFormData
    ) => {
      if (
        dialogState.mode === 'add'
      ) {
        return supabase
          .from('inventory')
          .insert([
            {
              ...payload,

              shop_id:
                profile.shop_id,

              created_by:
                user?.id,
            },
          ]);
      }

      return supabase
        .from('inventory')
        .update(payload)
        .eq(
          'id',
          dialogState.item?.id
        );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inventory'],
      });

      setDialogState({
        mode: null,
        item: null,
      });

      toast({
        title: 'Success',
        description:
          'Inventory updated',
      });
    },
  });

  const deleteMutation =
    useMutation({
      mutationFn: async (
        id: string
      ) => {
        return supabase
          .from('inventory')
          .delete()
          .eq('id', id);
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['inventory'],
        });

        toast({
          title: 'Deleted',
          description:
            'Product removed',
        });
      },
    });

  const filteredItems =
    useMemo(() => {
      return inventoryItems.filter(
        (item) => {
          const matchesSearch =
            item.item_name
              .toLowerCase()
              .includes(
                searchTerm.toLowerCase()
              );

          const matchesCategory =
            selectedCategory ===
              'all' ||
            item.category ===
              selectedCategory;

          let matchesTab = true;

          if (
            activeTab === 'active'
          ) {
            matchesTab =
              item.is_available &&
              item.quantity > 0;
          }

          if (
            activeTab === 'low'
          ) {
            matchesTab =
              item.quantity <=
              item.low_stock_threshold;
          }

          if (
            activeTab === 'out'
          ) {
            matchesTab =
              item.quantity === 0;
          }

          return (
            matchesSearch &&
            matchesCategory &&
            matchesTab
          );
        }
      );
    }, [
      inventoryItems,
      searchTerm,
      selectedCategory,
      activeTab,
    ]);

  const categories = [
    ...new Set(
      inventoryItems.map(
        (i) => i.category
      )
    ),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="container mx-auto p-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">

        <motion.div
          initial={{
            opacity: 0,
            y: -20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="h-8 w-8 text-green-600" />
              Inventory Management
            </h1>

            <p className="text-gray-500 mt-2">
              Manage supermarket products
            </p>
          </div>

          <Button
  onClick={() =>
    setDialogState({
      mode: 'add',
      item: null,
    })
  }
  className="bg-green-600 hover:bg-green-700"
>
  <Plus className="h-4 w-4 mr-2" />

  Add Product
</Button>
        </motion.div>
{/* ================================================= */}
{/* FILTERS */}
{/* ================================================= */}

<div className="flex flex-col md:flex-row gap-4 mb-8">

  <div className="relative flex-1">

    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />

    <Input
      placeholder="Search products..."
      value={searchTerm}
      onChange={(e) =>
        setSearchTerm(e.target.value)
      }
      className="pl-10"
    />

  </div>

  <Select
    value={selectedCategory}
    onValueChange={
      setSelectedCategory
    }
  >

    <SelectTrigger className="w-full md:w-64">

      <SelectValue placeholder="Category" />

    </SelectTrigger>

    <SelectContent>

      <SelectItem value="all">
        All Categories
      </SelectItem>

      {categories.map(
        (category) => (

          <SelectItem
            key={category}
            value={category}
          >
            {category}
          </SelectItem>
        )
      )}

    </SelectContent>

  </Select>

</div>

{/* ================================================= */}
{/* TABS */}
{/* ================================================= */}

<Tabs
  value={activeTab}
  onValueChange={setActiveTab}
  className="mb-8"
>

  <TabsList>

    <TabsTrigger value="all">
      All
    </TabsTrigger>

    <TabsTrigger value="active">
      Active
    </TabsTrigger>

    <TabsTrigger value="low">
      Low Stock
    </TabsTrigger>

    <TabsTrigger value="out">
      Out Of Stock
    </TabsTrigger>

  </TabsList>

</Tabs>

{/* ================================================= */}
{/* INVENTORY TABLE */}
{/* ================================================= */}

<Card>

  <CardHeader>

    <CardTitle>
      Products
    </CardTitle>

    <CardDescription>
      Inventory items
    </CardDescription>

  </CardHeader>

  <CardContent>

    {filteredItems.length === 0 ? (

      <div className="text-center py-16">

        <Box className="h-14 w-14 text-gray-300 mx-auto mb-4" />

        <h3 className="text-lg font-semibold">
          No inventory found
        </h3>

        <p className="text-gray-500 mt-2">
          Add your first product
        </p>

      </div>

    ) : (

      <Table>

        <TableHeader>

          <TableRow>

            <TableHead>
              Product
            </TableHead>

            <TableHead>
              Category
            </TableHead>

            <TableHead>
              Quantity
            </TableHead>

            <TableHead>
              Price
            </TableHead>

            <TableHead>
              Status
            </TableHead>

          </TableRow>

        </TableHeader>

        <TableBody>

          {filteredItems.map(
            (item) => (

              <TableRow
                key={item.id}
              >

                <TableCell>

                  <div>

                    <div className="font-medium">
                      {item.item_name}
                    </div>

                    <div className="text-sm text-gray-500">
                      {item.brand}
                    </div>

                  </div>

                </TableCell>

                <TableCell>
                  {item.category}
                </TableCell>

                <TableCell>

                  <Badge
                    variant={
                      item.quantity <=
                      item.low_stock_threshold
                        ? 'destructive'
                        : 'default'
                    }
                  >
                    {item.quantity}
                  </Badge>

                </TableCell>

                <TableCell>
                  ₹{item.unit_price}
                </TableCell>

                <TableCell>

                  {item.quantity ===
                  0 ? (

                    <Badge variant="destructive">
                      Out
                    </Badge>

                  ) : item.quantity <=
                    item.low_stock_threshold ? (

                    <Badge className="bg-yellow-500">
                      Low
                    </Badge>

                  ) : (

                    <Badge className="bg-green-600">
                      Active
                    </Badge>

                  )}

                </TableCell>

              </TableRow>
            )
          )}

        </TableBody>

      </Table>

    )}

  </CardContent>

</Card>
      </div>
      <Dialog
  open={dialogState.mode !== null}
  onOpenChange={(open) => {
    if (!open) {
      setDialogState({
        mode: null,
        item: null,
      });
    }
  }}
>

  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">

    <DialogHeader>

      <DialogTitle>
        {dialogState.mode === 'add'
          ? 'Add Product'
          : 'Edit Product'}
      </DialogTitle>

      <DialogDescription>
        Manage supermarket inventory
      </DialogDescription>

    </DialogHeader>

    <ProductForm
      initialData={
        dialogState.item || undefined
      }
      isSubmitting={
        mutation.isPending
      }
      onSubmit={(data) =>
        mutation.mutate(data)
      }
    />

  </DialogContent>

</Dialog>
    </div>
  );
}