import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
// import { useState } from "react";

export function CookiePreferencesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // const [marketing, setMarketing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl bg-muted text-muted-foreground p-0 overflow-hidden">
        <div className="p-6 pb-2">
          <DialogTitle className="text-lg font-semibold text-white mb-2">Cookie Preferences</DialogTitle>
          <div className="border-b border-white/10 mb-4" />
          <DialogDescription asChild>
            <div className="mb-6 text-sm text-white/80">
              You can customize your consent for different types of cookies here. Toggle each category on or off as desired. Strictly Necessary cookies are always active, as they're essential for the site's basic functionality. Other cookies are optional and will only be used if you enable them. We will remember your preferences and you can change or withdraw your consent at any time via this settings panel.
            </div>
          </DialogDescription>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-white">Strictly Necessary Cookies</span>
              <Switch checked disabled />
            </div>
            <div className="text-xs text-white/70">
              These cookies are essential for the website to function and cannot be switched off. They are typically set in response to actions you take, such as logging in or filling in forms. Because these cookies are necessary to deliver the service you requested, no consent is required for them.
            </div>
          </div>
          {/* <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-white">Marketing Performance Cookies</span>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </div>
            <div className="text-xs text-white/70">
              These cookies help us measure, optimize, and improve the effectiveness of our marketing campaigns. For example, they enable us to see which campaigns lead users to our site and how those campaigns perform overall.
            </div>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  );
} 