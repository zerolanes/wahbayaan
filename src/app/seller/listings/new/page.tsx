import { ListingForm } from "@/components/seller/listing-form";
import { Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerVendor, listCategoriesForSeller } from "@/lib/seller/queries";

export const metadata = { title: "Add a listing" };

export default async function NewListing() {
  const user = await requireSeller();
  const [categories, { vendor }] = await Promise.all([listCategoriesForSeller(), getSellerVendor(user.vendorId)]);
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Listings", href: "/seller/listings" }, { label: "Add a listing" }]} />
      <PageHeader
        eyebrow="New piece"
        title="Add a listing"
        description="Price it in rupees for what you want to receive. Shipping and import duty are added for the buyer — you'll see the full picture after saving."
      />
      <ListingForm categories={categories} defaults={{ categoryId: vendor.primaryCategoryId ?? undefined }} />
    </div>
  );
}
