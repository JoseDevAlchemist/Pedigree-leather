/**
 * Types for the Supabase schema.
 *
 * Hand-written, not generated: `supabase gen types typescript` needs a live
 * database connection, which a build does not have. The shape below is the one
 * that command emits, so regenerating once the database is up is a drop-in
 * replacement and will not need this file edited afterwards.
 *
 * Regenerate with:
 *
 *   supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 *
 * ---------------------------------------------------------------------------
 * Why this file is worth the trouble
 * ---------------------------------------------------------------------------
 * Without a `Database` generic, `supabase.from("products")` is `any`: a typo in a
 * column name is not a type error, it is a 400 from PostgREST at runtime, on the
 * shop's front page. With it, `products.basePrice` fails to compile.
 *
 * The mapping between the database's snake_case columns and the app's camelCase
 * `Product` is *not* done here. This file describes the wire format; the mapping
 * lives in `lib/api.ts` and `lib/admin-api.ts`, where it can be tested and where
 * it is visible. Two layers of renaming would be one too many.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** The eight-angle union, mirroring `Angle` in lib/types.ts and the CHECK in 001. */
export type AngleValue =
  | "front"
  | "side-left"
  | "side-right"
  | "side"
  | "top"
  | "bottom"
  | "back"
  | "laces";

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          category: string;
          base_price: number;
          discount_percent: number;
          stock_quantity: number;
          featured: boolean;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          category: string;
          base_price: number;
          discount_percent?: number;
          stock_quantity?: number;
          featured?: boolean;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string;
          category?: string;
          base_price?: number;
          discount_percent?: number;
          stock_quantity?: number;
          featured?: boolean;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey";
            columns: ["product_id"];
            isOneToMany: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      product_colors: {
        Row: {
          id: string;
          product_id: string;
          color_name: string;
          color_hex: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          color_name: string;
          color_hex: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          color_name?: string;
          color_hex?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_colors_product_id_fkey";
            columns: ["product_id"];
            isOneToMany: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      product_images: {
        Row: {
          id: string;
          color_id: string;
          angle: string;
          image_url: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          color_id: string;
          angle: string;
          image_url?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          color_id?: string;
          angle?: string;
          image_url?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_color_id_fkey";
            columns: ["color_id"];
            isOneToMany: false;
            referencedRelation: "product_colors";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Views: Record<never, never>;

    Functions: Record<never, never>;

    Enums: Record<never, never>;

    CompositeTypes: Record<never, never>;
  };
};

/** Convenience alias for a table's row type: `Tables<"products">["Row"]`. */
export type Tables<Table extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Table];