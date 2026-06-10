"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, Ban, CheckCircle, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDateShort } from "@/lib/utils";

interface Courier {
  id: string;
  name: string;
  phone?: string | null;
  telegram?: string | null;
  login: string;
  courierStatus: string;
  isOnline: boolean;
  qrToken?: string | null;
  telegramChatId?: string | null;
  createdAt: string;
}

const emptyForm = {
  name: "",
  phone: "",
  telegram: "",
  login: "",
  password: "",
  telegramChatId: "",
};

export function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadCouriers() {
    const res = await fetch("/api/couriers");
    setCouriers(await res.json());
  }

  useEffect(() => {
    loadCouriers();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(courier: Courier) {
    setEditing(courier);
    setForm({
      name: courier.name,
      phone: courier.phone || "",
      telegram: courier.telegram || "",
      login: courier.login,
      password: "",
      telegramChatId: courier.telegramChatId || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/couriers/${editing.id}` : "/api/couriers";
    const method = editing ? "PUT" : "POST";
    const body = editing && !form.password ? { ...form, password: undefined } : form;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Курьер обновлён" : "Курьер добавлен" });
    setDialogOpen(false);
    loadCouriers();
  }

  async function toggleBlock(courier: Courier) {
    const action = courier.courierStatus === "ACTIVE" ? "block" : "unblock";
    await fetch(`/api/couriers/${courier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    toast({ title: action === "block" ? "Курьер заблокирован" : "Курьер разблокирован" });
    loadCouriers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить курьера?")) return;
    await fetch(`/api/couriers/${id}`, { method: "DELETE" });
    toast({ title: "Курьер удалён" });
    loadCouriers();
  }

  async function showQr(courier: Courier) {
    setSelectedCourier(courier);
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/qr?token=${courier.qrToken}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
    setQrDataUrl(dataUrl);
    setQrDialogOpen(true);
  }

  async function regenerateQr(courier: Courier) {
    const res = await fetch(`/api/couriers/${courier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate-qr" }),
    });
    const updated = await res.json();
    await showQr({ ...courier, qrToken: updated.qrToken });
    loadCouriers();
    toast({ title: "QR-код обновлён" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Курьеры</h1>
          <p className="text-muted-foreground">Управление курьерами</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Редактировать курьера" : "Новый курьер"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Имя</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telegram</Label>
                <Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
              </div>
              <div className="space-y-2">
                <Label>Telegram Chat ID</Label>
                <Input value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} placeholder="562345561" />
              </div>
              <div className="space-y-2">
                <Label>Логин</Label>
                <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{editing ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
              </div>
              <Button type="submit" className="w-full">{editing ? "Сохранить" : "Создать"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {couriers.map((courier) => (
          <Card key={courier.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{courier.name}</h3>
                  <p className="text-sm text-muted-foreground">@{courier.login}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={courier.courierStatus === "ACTIVE" ? "success" : "destructive"}>
                    {courier.courierStatus === "ACTIVE" ? "Активен" : "Заблокирован"}
                  </Badge>
                  <Badge variant={courier.isOnline ? "success" : "secondary"}>
                    {courier.isOnline ? "Онлайн" : "Офлайн"}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {courier.phone && <p>📞 {courier.phone}</p>}
                {courier.telegram && <p>✈️ {courier.telegram}</p>}
                <p className="text-muted-foreground">Рег: {formatDateShort(courier.createdAt)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(courier)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => showQr(courier)}>
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleBlock(courier)}>
                  {courier.courierStatus === "ACTIVE" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(courier.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>QR-код — {selectedCourier?.name}</DialogTitle>
          </DialogHeader>
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="mx-auto rounded-lg" />}
          <p className="text-sm text-muted-foreground">Отсканируйте для быстрого входа</p>
          <Button variant="outline" onClick={() => selectedCourier && regenerateQr(selectedCourier)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить QR
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
