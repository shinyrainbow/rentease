"use client";

import { useEffect, useState, useRef } from "react";
import liff from "@line/liff";

interface Invoice {
  id: string;
  invoiceNo: string;
  totalAmount: number;
  paidAmount: number;
  billingMonth: string;
  dueDate: string;
  status: string;
  unit: { unitNumber: string };
}

interface TenantData {
  tenant: { id: string; name: string; nameTh: string | null };
  project: { id: string; name: string; nameTh: string | null };
  invoices: Invoice[];
}

export default function LiffPage() {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null);
  const [data, setData] = useState<TenantData | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setError("LIFF ID not configured");
          setLoading(false);
          return;
        }

        await liff.init({ liffId });
        setInitialized(true);

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
        });

        // Fetch invoices
        const res = await fetch(`/api/liff/invoices?lineUserId=${userProfile.userId}`);
        if (res.ok) {
          const invoiceData = await res.json();
          setData(invoiceData);
        } else {
          const err = await res.json();
          setError(err.error || "ไม่พบข้อมูลผู้เช่า กรุณาติดต่อเจ้าหน้าที่");
        }
      } catch (err) {
        console.error("LIFF init error:", err);
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    };

    initLiff();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSlipPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!profile || !selectedInvoice || !slipPreview) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/submit-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.userId,
          invoiceId: selectedInvoice,
          base64Image: slipPreview,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        // Close LIFF after 2 seconds
        setTimeout(() => {
          if (liff.isInClient()) {
            liff.closeWindow();
          }
        }, 2000);
      } else {
        const err = await res.json();
        setError(err.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("เกิดข้อผิดพลาดในการส่งสลิป");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <p className="text-gray-800 font-medium">{error}</p>
          <p className="text-gray-500 text-sm mt-2">
            กรุณาติดต่อเจ้าหน้าที่เพื่อเชื่อมต่อบัญชี LINE ของคุณ
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <p className="text-gray-800 font-medium text-lg">ส่งสลิปเรียบร้อยแล้ว</p>
          <p className="text-gray-500 text-sm mt-2">รอการตรวจสอบจากเจ้าหน้าที่</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-gray-800">ส่งสลิปชำระเงิน</h1>
        {data && (
          <p className="text-gray-500 text-sm mt-1">
            {data.project.nameTh || data.project.name}
          </p>
        )}
      </div>

      {/* Tenant Info */}
      {data && (
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <p className="text-sm text-gray-500">ผู้เช่า</p>
          <p className="font-medium">{data.tenant.nameTh || data.tenant.name}</p>
        </div>
      )}

      {/* Invoice Selection */}
      {data && data.invoices.length > 0 ? (
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">เลือกใบแจ้งหนี้</label>
          <select
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
          >
            <option value="">-- เลือกใบแจ้งหนี้ --</option>
            {data.invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNo} - ฿{(invoice.totalAmount - invoice.paidAmount).toLocaleString()} ({invoice.unit.unitNumber})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="bg-green-50 rounded-lg p-4 mb-4 text-center">
          <p className="text-green-700">ไม่มีใบแจ้งหนี้ค้างชำระ</p>
        </div>
      )}

      {/* Slip Upload */}
      {selectedInvoice && (
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">อัพโหลดสลิป</label>

          {slipPreview ? (
            <div className="relative">
              <img
                src={slipPreview}
                alt="Slip preview"
                className="w-full rounded-lg border"
              />
              <button
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center"
                onClick={() => {
                  setSlipPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl text-gray-400 mb-2">📷</div>
              <p className="text-gray-500">แตะเพื่อเลือกรูปสลิป</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {/* Submit Button */}
      {selectedInvoice && slipPreview && (
        <button
          className="w-full bg-green-500 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
              กำลังส่ง...
            </span>
          ) : (
            "ส่งสลิป"
          )}
        </button>
      )}

      {/* Error Message */}
      {error && data && (
        <div className="bg-red-50 text-red-600 rounded-lg p-3 mt-4 text-center text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
