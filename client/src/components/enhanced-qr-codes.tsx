import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, RotateCcw, Save } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import type { Link, Paginated, QrSettingsInput } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type Style = Required<QrSettingsInput> & { size: number };
type SavedStyle = Style & { customized: boolean };

const DEFAULT_STYLE: Style = { size: 512, darkColor: "#000000", lightColor: "#ffffff", errorCorrection: "M" };
const EC_LABELS = { L: "Low (7%)", M: "Medium (15%)", Q: "Quartile (25%)", H: "High (30%)" } as const;

export default function EnhancedQrCodes() {
  const { toast } = useToast();
  const params = new URLSearchParams(useSearch());
  const { data: links, isLoading } = useQuery<Paginated<Link>>({ queryKey: ["/api/links?limit=100"] });
  const [linkId, setLinkId] = useState<string | null>(params.get("link"));
  const link = links?.items.find((l) => l.id === linkId) ?? links?.items[0];

  const settingsKey = link ? `/api/links/${link.id}/qr/settings` : null;
  const { data: saved } = useQuery<SavedStyle>({ queryKey: [settingsKey], enabled: Boolean(settingsKey) });
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    if (saved) setStyle({ size: saved.size, darkColor: saved.darkColor, lightColor: saved.lightColor, errorCorrection: saved.errorCorrection });
  }, [saved]);

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link.shortUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: style.errorCorrection,
      color: { dark: style.darkColor, light: style.lightColor },
    })
      .then(setPreview)
      .catch(() => setPreview(""));
  }, [link, style]);

  const save = useMutation({
    mutationFn: () => api<SavedStyle>("PUT", settingsKey!, style),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [settingsKey] });
      toast({ title: "QR style saved", description: "Downloads now use this style." });
    },
    onError: (err: Error) => toast({ title: "Couldn't save", description: err.message, variant: "destructive" }),
  });
  const reset = useMutation({
    mutationFn: () => api("DELETE", settingsKey!),
    onSuccess: () => {
      setStyle(DEFAULT_STYLE);
      queryClient.invalidateQueries({ queryKey: [settingsKey] });
      toast({ title: "QR style reset" });
    },
  });

  const dirty = saved && JSON.stringify({ ...style }) !== JSON.stringify({ size: saved.size, darkColor: saved.darkColor, lightColor: saved.lightColor, errorCorrection: saved.errorCorrection });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!links?.items.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Create a short link on the dashboard first, then come back to make its QR code.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_auto] gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Customize</CardTitle>
          <CardDescription>Styling is saved per link and used for downloads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Link</Label>
            <Select value={link?.id} onValueChange={setLinkId}>
              <SelectTrigger aria-label="Link"><SelectValue /></SelectTrigger>
              <SelectContent>
                {links.items.map((l) => (
                  <SelectItem key={l.id} value={l.id}>/{l.shortCode}{l.title ? ` · ${l.title}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Download size: {style.size}px</Label>
            <Slider className="mt-3" min={128} max={1024} step={32} value={[style.size]} onValueChange={([size]) => setStyle({ ...style, size })} aria-label="Size in pixels" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(["darkColor", "lightColor"] as const).map((key) => (
              <div key={key}>
                <Label htmlFor={key}>{key === "darkColor" ? "Foreground" : "Background"}</Label>
                <div className="flex gap-2 mt-1">
                  <input id={key} type="color" className="h-10 w-12 rounded border" value={style[key]} onChange={(e) => setStyle({ ...style, [key]: e.target.value })} />
                  <Input id={`${key}-hex`} name={key} value={style[key]} aria-label={`${key} hex`} pattern="^#[0-9a-fA-F]{6}$" maxLength={7}
                    onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setStyle({ ...style, [key]: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>Error correction</Label>
            <Select value={style.errorCorrection} onValueChange={(v) => setStyle({ ...style, errorCorrection: v as Style["errorCorrection"] })}>
              <SelectTrigger aria-label="Error correction"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EC_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Higher correction survives damage or a logo overlay, but makes a denser code.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !/^#[0-9a-fA-F]{6}$/.test(style.darkColor) || !/^#[0-9a-fA-F]{6}$/.test(style.lightColor)}>
              <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Saving…" : "Save style"}
            </Button>
            {saved?.customized && (
              <Button variant="outline" onClick={() => reset.mutate()}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset to default
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:w-96">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription className="font-mono break-all">{link?.shortUrl}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 flex justify-center" style={{ background: style.lightColor }}>
            {preview ? <img src={preview} alt={`QR code for ${link?.shortUrl}`} className="w-64 h-64" /> : <div className="w-64 h-64" />}
          </div>
          {dirty && <p className="text-xs text-amber-600">Unsaved changes. Downloads use the saved style.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/links/${link?.id}/qr?format=png&download=1`} download><Download className="h-4 w-4 mr-2" /> PNG</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/links/${link?.id}/qr?format=svg&download=1`} download><Download className="h-4 w-4 mr-2" /> SVG</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
