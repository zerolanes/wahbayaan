import { Boxes, FileSpreadsheet, FolderKanban, LayoutDashboard, Package, PlusCircle, Store } from "lucide-react";
import type { NavGroup } from "@/components/dashboard/nav-types";

export function brandPortalNav(c: { toPrepare: number; drafts: number }): NavGroup[] {
  return [
    {
      label: "Catalogue",
      items: [
        { href: "/brand-portal", label: "Overview", icon: <LayoutDashboard />, exact: true },
        { href: "/brand-portal/products", label: "Products", icon: <Boxes />, exact: true, badge: c.drafts },
        { href: "/brand-portal/products/new", label: "Add a product", icon: <PlusCircle /> },
        { href: "/brand-portal/import", label: "CSV upload", icon: <FileSpreadsheet /> },
        { href: "/brand-portal/collections", label: "Collections", icon: <FolderKanban /> },
      ],
    },
    {
      label: "Sales",
      items: [{ href: "/brand-portal/orders", label: "Orders", icon: <Package />, badge: c.toPrepare }],
    },
    {
      label: "Your brand",
      items: [{ href: "/brand-portal/profile", label: "Brand page", icon: <Store /> }],
    },
  ];
}
