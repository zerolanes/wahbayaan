import { AnalyticsTabs } from "@/components/admin/analytics";
import { BannerEditor } from "@/components/admin/banner-editor";
import { PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { getAnalyticsSettings, getConsentBanner } from "@/lib/analytics/store";
import { resetBannerAction, saveBannerAction } from "@/app/actions/admin/analytics";

export const metadata = { title: "Cookie banner" };

export default async function CookieBannerPage() {
  await requireStaff("analytics.manage");
  const [banner, analytics] = await Promise.all([getConsentBanner(), getAnalyticsSettings()]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Cookie banner"
        description="Look and texts of the privacy banner visitors see on the storefront. Groups and service cards come from the service registry; raise the consent version under Privacy & tracking when services change."
      />
      <AnalyticsTabs active="/admin/privacy/banner" />
      <BannerEditor initial={banner} saveAction={saveBannerAction} resetAction={resetBannerAction} retentionDays={analytics.retentionDays} />
    </div>
  );
}
