"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MessageCircle,
  Settings,
  CheckCircle,
  XCircle,
  Send,
  Link2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Receipt,
  Plus,
  Edit,
  Trash2,
  Users,
  FolderOpen,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { formatDateTime } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  lineChannelId: string | null;
  lineChannelSecret: string | null;
  lineAccessToken: string | null;
}

interface Tenant {
  id: string;
  name: string;
  nameTh: string | null;
  unit: { unitNumber: string; projectId: string };
}

interface LineMessage {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  messageType: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

interface LineOAAccount {
  id: string;
  name: string;
  lineChannelId: string | null;
  lineChannelSecret: string | null;
  lineAccessToken: string | null;
  liffId: string | null;
  projects: { id: string; name: string; nameTh: string | null }[];
  _count: { contacts: number };
}

interface LineContact {
  id: string;
  lineUserId: string;
  contactType: "USER" | "GROUP";
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  projectId: string | null;
  lineOaId: string;
  lineOa: { id: string; name: string } | null;
  project: { id: string; name: string; nameTh: string | null } | null;
  tenant: { id: string; name: string; nameTh: string | null } | null;
  messages: LineMessage[];
  updatedAt: string;
}

export default function LineOAPage() {
  const t = useTranslations("lineOA");
  const tCommon = useTranslations("common");

  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<LineContact[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedContact, setSelectedContact] = useState<LineContact | null>(null);
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [linkingTenant, setLinkingTenant] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isSaveSlipOpen, setIsSaveSlipOpen] = useState(false);
  const [lineOaAccounts, setLineOaAccounts] = useState<LineOAAccount[]>([]);
  const [editingLineOa, setEditingLineOa] = useState<LineOAAccount | null>(null);
  const [isAssignProjectsOpen, setIsAssignProjectsOpen] = useState(false);
  const [assigningLineOa, setAssigningLineOa] = useState<LineOAAccount | null>(null);
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(new Set());
  const [savingProjects, setSavingProjects] = useState(false);
  const [deleteLineOaOpen, setDeleteLineOaOpen] = useState(false);
  const [deletingLineOa, setDeletingLineOa] = useState<LineOAAccount | null>(null);
  const [deletingOa, setDeletingOa] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedLinkProject, setSelectedLinkProject] = useState<string>("");
  const [slipMessageId, setSlipMessageId] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [savingSlip, setSavingSlip] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Array<{ id: string; invoiceNo: string; totalAmount: number; paidAmount: number; dueDate: string; type: string; tenant: { name: string } }>>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    lineChannelId: "",
    lineChannelSecret: "",
    lineAccessToken: "",
    liffId: "",
  });

  // Track expanded/collapsed state for each project in chat list
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Group contacts by LINE OA
  const contactsByOa = contacts.reduce((acc, contact) => {
    const oaId = contact.lineOaId;
    if (!acc[oaId]) {
      acc[oaId] = {
        lineOa: contact.lineOa,
        contacts: [],
      };
    }
    acc[oaId].contacts.push(contact);
    return acc;
  }, {} as Record<string, { lineOa: { id: string; name: string } | null; contacts: LineContact[] }>);

  const toggleOaExpanded = (oaId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(oaId)) {
        next.delete(oaId);
      } else {
        next.add(oaId);
      }
      return next;
    });
  };

  // Initialize all OAs as expanded on first load
  useEffect(() => {
    if (contacts.length > 0 && expandedProjects.size === 0) {
      const allOaIds = new Set(contacts.map((c) => c.lineOaId));
      setExpandedProjects(allOaIds);
    }
  }, [contacts]);

  const fetchData = async () => {
    try {
      const [projectsRes, contactsRes, tenantsRes, lineOaRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/line/contacts"),
        fetch("/api/tenants?status=ACTIVE"),
        fetch("/api/line-oa"),
      ]);
      const [projectsData, contactsData, tenantsData, lineOaData] = await Promise.all([
        projectsRes.json(),
        contactsRes.json(),
        tenantsRes.json(),
        lineOaRes.json(),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      setLineOaAccounts(Array.isArray(lineOaData) ? lineOaData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async (contactId: string) => {
    try {
      const res = await fetch(`/api/line/contacts/${contactId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSelectContact = async (contact: LineContact) => {
    setSelectedContact(contact);
    setLoadingMessages(true);
    try {
      await fetchMessages(contact.id);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineContactId: selectedContact.id,
          message: newMessage,
        }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchMessages(selectedContact.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleAddLineOa = () => {
    setEditingLineOa(null);
    setFormData({ name: "", lineChannelId: "", lineChannelSecret: "", lineAccessToken: "", liffId: "" });
    setIsSettingsOpen(true);
  };

  const handleEditLineOa = (oa: LineOAAccount) => {
    setEditingLineOa(oa);
    setFormData({
      name: oa.name,
      lineChannelId: oa.lineChannelId || "",
      lineChannelSecret: oa.lineChannelSecret || "",
      lineAccessToken: oa.lineAccessToken || "",
      liffId: oa.liffId || "",
    });
    setIsSettingsOpen(true);
  };

  const handleSaveLineOa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const url = editingLineOa ? `/api/line-oa/${editingLineOa.id}` : "/api/line-oa";
      const method = editingLineOa ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsSettingsOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving LINE OA:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenAssignProjects = (oa: LineOAAccount) => {
    setAssigningLineOa(oa);
    setAssignedProjectIds(new Set(oa.projects.map((p) => p.id)));
    setIsAssignProjectsOpen(true);
  };

  const handleSaveAssignProjects = async () => {
    if (!assigningLineOa) return;
    setSavingProjects(true);
    try {
      const res = await fetch(`/api/line-oa/${assigningLineOa.id}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: Array.from(assignedProjectIds) }),
      });
      if (res.ok) {
        setIsAssignProjectsOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error assigning projects:", error);
    } finally {
      setSavingProjects(false);
    }
  };

  const handleDeleteLineOa = async () => {
    if (!deletingLineOa) return;
    setDeletingOa(true);
    try {
      const res = await fetch(`/api/line-oa/${deletingLineOa.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteLineOaOpen(false);
        setDeletingLineOa(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting LINE OA:", error);
    } finally {
      setDeletingOa(false);
    }
  };

  const handleLinkTenant = async () => {
    if (!selectedContact) return;

    setLinkingTenant(true);
    try {
      const res = await fetch("/api/line/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          tenantId: selectedTenant || null,
        }),
      });

      if (res.ok) {
        setIsLinkOpen(false);
        setSelectedTenant("");
        fetchData();
        const updatedContact = await res.json();
        setSelectedContact(updatedContact);
      }
    } catch (error) {
      console.error("Error linking tenant:", error);
    } finally {
      setLinkingTenant(false);
    }
  };

  const isOaConnected = (oa: LineOAAccount) => {
    return oa.lineChannelId && oa.lineChannelSecret && oa.lineAccessToken;
  };

  const handleOpenSaveSlip = async (messageId: string) => {
    if (!selectedContact?.tenant) return;

    setSlipMessageId(messageId);
    setSelectedInvoice("");
    setIsSaveSlipOpen(true);

    // Fetch unpaid invoices for this tenant
    try {
      const res = await fetch(`/api/invoices?tenantId=${selectedContact.tenant.id}&status=PENDING,PARTIAL,OVERDUE`);
      if (res.ok) {
        const data = await res.json();
        setUnpaidInvoices(data);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    }
  };

  const handleSaveSlip = async () => {
    if (!selectedContact || !slipMessageId || !selectedInvoice) return;

    setSavingSlip(true);
    try {
      const res = await fetch("/api/line/save-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: slipMessageId,
          projectId: selectedContact.projectId,
          invoiceId: selectedInvoice,
        }),
      });

      if (res.ok) {
        setIsSaveSlipOpen(false);
        setSlipMessageId("");
        setSelectedInvoice("");
        setSuccessMessage("บันทึกสลิปเรียบร้อยแล้ว / Slip saved successfully");
      } else {
        const error = await res.json();
        setErrorMessage(error.error || "Failed to save slip");
      }
    } catch (error) {
      console.error("Error saving slip:", error);
      setErrorMessage("Error saving slip");
    } finally {
      setSavingSlip(false);
    }
  };

  // Filter tenants by selected project in the link dialog
  const linkableTenants = selectedLinkProject
    ? tenants.filter((t) => t.unit.projectId === selectedLinkProject)
    : tenants;

  if (loading) {
    return <PageSkeleton columns={4} rows={5} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("settings")}
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="h-[calc(100vh-220px)] min-h-[500px]">
          <div className="grid gap-6 lg:grid-cols-3 h-full">
            {/* Contacts List - Grouped by Project/Channel */}
            <Card className="lg:col-span-1 flex flex-col overflow-hidden">
              <CardHeader className="py-3 flex-shrink-0">
                <CardTitle className="text-sm">LINE Contacts ({contacts.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {contacts.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No LINE contacts yet. Users will appear here when they add your LINE OA.
                    </div>
                  ) : (
                    <div>
                      {Object.entries(contactsByOa).map(([oaId, { lineOa, contacts: oaContacts }]) => (
                        <div key={oaId} className="border-b last:border-b-0">
                          {/* LINE OA Header - Collapsible */}
                          <div
                            className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted transition-colors sticky top-0 z-10"
                            onClick={() => toggleOaExpanded(oaId)}
                          >
                            {expandedProjects.has(oaId) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className="font-medium text-sm truncate">
                                {lineOa?.name || "LINE OA"}
                                {(() => {
                                  const oaAccount = lineOaAccounts.find((a) => a.id === oaId);
                                  if (oaAccount && oaAccount.projects.length > 0) {
                                    return <span className="text-muted-foreground font-normal"> ({oaAccount.projects.map((p) => p.name).join(", ")})</span>;
                                  }
                                  return null;
                                })()}
                              </span>
                              <Badge variant="outline" className="text-xs shrink-0 ml-2">
                                {oaContacts.length}
                              </Badge>
                            </div>
                          </div>

                          {/* OA Contacts */}
                          {expandedProjects.has(oaId) && (
                            <div className="divide-y">
                              {oaContacts.map((contact) => (
                                <div
                                  key={contact.id}
                                  className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                                    selectedContact?.id === contact.id ? "bg-accent" : ""
                                  }`}
                                  onClick={() => handleSelectContact(contact)}
                                >
                                  <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarImage src={contact.pictureUrl || undefined} />
                                      <AvatarFallback>
                                        {contact.displayName?.[0] || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium truncate">{contact.displayName}</p>
                                        {contact.contactType === "GROUP" && (
                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                                            Group
                                          </Badge>
                                        )}
                                      </div>
                                      {(contact.project || contact.tenant) && (
                                        <div className="flex flex-wrap items-center gap-1 mt-1">
                                          {contact.project && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                              {contact.project.name}
                                            </Badge>
                                          )}
                                          {contact.tenant && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                              {contact.tenant.name}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                      {contact.messages[0] && (
                                        <p className="text-xs text-muted-foreground truncate mt-1">
                                          {contact.messages[0].content || `[${contact.messages[0].messageType}]`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2 flex flex-col overflow-hidden">
              {selectedContact ? (
                <>
                  {/* Chat Header */}
                  <CardHeader className="py-3 border-b flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={selectedContact.pictureUrl || undefined} />
                        <AvatarFallback>
                          {selectedContact.displayName?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {selectedContact.displayName}
                          {selectedContact.contactType === "GROUP" && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Group
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {selectedContact.tenant ? (
                            <span className="text-green-600">
                              Linked: {selectedContact.tenant.name}
                              {selectedContact.project && ` (${selectedContact.project.name})`}
                            </span>
                          ) : (
                            <span className="text-orange-500">Not linked to tenant</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTenant(selectedContact.tenant?.id || "");
                        setSelectedLinkProject(selectedContact.project?.id || "");
                        setIsLinkOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {selectedContact.tenant ? "Change" : "Link"}
                    </Button>
                  </CardHeader>

                  {/* Messages */}
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-4">
                      <div className="space-y-4">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          No messages yet
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.direction === "OUTGOING" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                msg.direction === "OUTGOING"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {msg.messageType === "image" ? (
                                <div className="space-y-2">
                                  {msg.mediaUrl ? (
                                    <img
                                      src={msg.direction === "OUTGOING"
                                        ? msg.mediaUrl
                                        : `/api/line/image/${msg.mediaUrl}?lineOaId=${selectedContact.lineOaId}${selectedContact.projectId ? `&projectId=${selectedContact.projectId}` : ''}`}
                                      alt="LINE Image"
                                      className="max-w-48 max-h-48 rounded-lg cursor-pointer hover:opacity-90 object-cover bg-muted"
                                      loading="lazy"
                                      onClick={() => window.open(
                                        msg.direction === "OUTGOING"
                                          ? msg.mediaUrl!
                                          : `/api/line/image/${msg.mediaUrl}?lineOaId=${selectedContact.lineOaId}${selectedContact.projectId ? `&projectId=${selectedContact.projectId}` : ''}`,
                                        "_blank"
                                      )}
                                    />
                                  ) : (
                                    <div className="w-48 h-24 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                                      [รูปภาพ]
                                    </div>
                                  )}
                                  {msg.direction === "INCOMING" && selectedContact.tenant && msg.mediaUrl && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full"
                                      onClick={() => handleOpenSaveSlip(msg.mediaUrl!)}
                                    >
                                      <Receipt className="h-4 w-4 mr-2" />
                                      เก็บสลิป
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">
                                  {msg.content || `[${msg.messageType}]`}
                                </p>
                              )}
                              <p className="text-xs opacity-70 mt-1">
                                {formatDateTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t shrink-0">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a contact to start chatting</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-green-500" />
                      LINE Official Accounts
                    </CardTitle>
                    <CardDescription>
                      จัดการบัญชี LINE OA และเชื่อมต่อกับโครงการ / Manage LINE OA accounts and link to projects
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddLineOa}>
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่ม LINE OA
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lineOaAccounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">ยังไม่มีบัญชี LINE OA</p>
                    <p className="text-xs mt-1">กดปุ่ม &quot;เพิ่ม LINE OA&quot; เพื่อเริ่มต้น</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lineOaAccounts.map((oa) => (
                      <div key={oa.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{oa.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {oa.lineChannelId || "ยังไม่ได้ตั้งค่า"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOaConnected(oa) ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t("connected")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                {t("notConnected")}
                              </Badge>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleEditLineOa(oa)}>
                              <Edit className="h-4 w-4 mr-1" />
                              แก้ไข
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleOpenAssignProjects(oa)}>
                              <FolderOpen className="h-4 w-4 mr-1" />
                              โครงการ
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setDeletingLineOa(oa); setDeleteLineOaOpen(true); }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{oa._count.contacts} contacts</span>
                          <span className="text-muted-foreground">·</span>
                          {oa.projects.length === 0 ? (
                            <span className="text-xs text-orange-500">ยังไม่ได้เชื่อมโครงการ</span>
                          ) : (
                            oa.projects.map((p) => (
                              <Badge key={p.id} variant="outline" className="text-xs">
                                {p.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook URL</CardTitle>
                <CardDescription>
                  Use this URL in your LINE Developer Console for webhook settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/line/webhook`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/line/webhook`);
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* LINE OA Edit Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLineOa ? `แก้ไข LINE OA - ${editingLineOa.name}` : "เพิ่ม LINE OA"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLineOa} className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อ LINE OA *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น BizSpace LINE OA"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("channelId")}</Label>
              <Input
                value={formData.lineChannelId}
                onChange={(e) => setFormData({ ...formData, lineChannelId: e.target.value })}
                placeholder="1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("channelSecret")}</Label>
              <Input
                type="password"
                value={formData.lineChannelSecret}
                onChange={(e) => setFormData({ ...formData, lineChannelSecret: e.target.value })}
                placeholder="Enter channel secret"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("accessToken")}</Label>
              <Input
                type="password"
                value={formData.lineAccessToken}
                onChange={(e) => setFormData({ ...formData, lineAccessToken: e.target.value })}
                placeholder="Enter access token"
              />
            </div>

            <div className="space-y-2">
              <Label>LIFF ID</Label>
              <Input
                value={formData.liffId}
                onChange={(e) => setFormData({ ...formData, liffId: e.target.value })}
                placeholder="LIFF ID (optional)"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={savingSettings}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={savingSettings}>
                {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Projects Dialog */}
      <Dialog open={isAssignProjectsOpen} onOpenChange={setIsAssignProjectsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              เชื่อมโครงการ - {assigningLineOa?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              เลือกโครงการที่จะใช้ LINE OA นี้ / Select projects to link with this LINE OA
            </p>
            <div className="space-y-3">
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                  <Checkbox
                    checked={assignedProjectIds.has(project.id)}
                    onCheckedChange={(checked) => {
                      setAssignedProjectIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          next.add(project.id);
                        } else {
                          next.delete(project.id);
                        }
                        return next;
                      });
                    }}
                  />
                  <span className="font-medium">{project.name}</span>
                </label>
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ไม่มีโครงการ</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignProjectsOpen(false)} disabled={savingProjects}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSaveAssignProjects} disabled={savingProjects}>
                {savingProjects && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete LINE OA Confirmation */}
      <Dialog open={deleteLineOaOpen} onOpenChange={setDeleteLineOaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">ลบ LINE OA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              ต้องการลบ <strong>{deletingLineOa?.name}</strong> หรือไม่?
            </p>
            {deletingLineOa && deletingLineOa._count.contacts > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                LINE OA นี้มี {deletingLineOa._count.contacts} contacts — จะถูกลบทั้งหมดรวมถึงประวัติแชท
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteLineOaOpen(false)} disabled={deletingOa}>
                {tCommon("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteLineOa} disabled={deletingOa}>
                {deletingOa && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                ลบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Tenant Dialog */}
      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Link to Tenant - {selectedContact?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Project</Label>
              <Select
                value={selectedLinkProject || "__all__"}
                onValueChange={(v) => {
                  setSelectedLinkProject(v === "__all__" ? "" : v);
                  setSelectedTenant(""); // Reset tenant when project changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">-- All Projects --</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Tenant</Label>
              <Select
                value={selectedTenant || "__none__"}
                onValueChange={(v) => setSelectedTenant(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant to link" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- No Link --</SelectItem>
                  {linkableTenants.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      {selectedLinkProject ? "No active tenants in this project" : "No active tenants found"}
                    </div>
                  ) : (
                    linkableTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} - {tenant.unit?.unitNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking allows the system to automatically process maintenance requests
                and send invoices/receipts to this LINE user.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsLinkOpen(false)} disabled={linkingTenant}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleLinkTenant} disabled={linkingTenant}>
                {linkingTenant && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Slip Dialog */}
      <Dialog open={isSaveSlipOpen} onOpenChange={setIsSaveSlipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              เก็บสลิป - {selectedContact?.tenant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {slipMessageId && selectedContact && (
              <div className="flex justify-center">
                <img
                  src={`/api/line/image/${slipMessageId}?lineOaId=${selectedContact.lineOaId}${selectedContact.projectId ? `&projectId=${selectedContact.projectId}` : ''}`}
                  alt="Payment Slip"
                  className="max-h-48 rounded-lg"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>เลือกใบแจ้งหนี้ / Select Invoice</Label>
              <Select
                value={selectedInvoice || "__none__"}
                onValueChange={(v) => setSelectedInvoice(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกใบแจ้งหนี้" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- เลือกใบแจ้งหนี้ --</SelectItem>
                  {unpaidInvoices.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      ไม่มีใบแจ้งหนี้ค้างชำระ
                    </div>
                  ) : (
                    unpaidInvoices.map((invoice) => {
                      const typeLabel = invoice.type === "RENT" ? "ค่าเช่า" : invoice.type === "UTILITY" ? "ค่าสาธารณูปโภค" : "รวม";
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNo} - {invoice.tenant.name} - {new Date(invoice.dueDate).toISOString().split("T")[0]} - {typeLabel} (฿{(invoice.totalAmount - invoice.paidAmount).toLocaleString()})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                สลิปจะถูกบันทึกไว้ในระบบการชำระเงิน รอการตรวจสอบ
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSaveSlipOpen(false)} disabled={savingSlip}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSaveSlip} disabled={savingSlip || !selectedInvoice}>
                {savingSlip && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                เก็บสลิป
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Message Dialog */}
      <Dialog open={!!successMessage} onOpenChange={() => setSuccessMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              สำเร็จ / Success
            </DialogTitle>
          </DialogHeader>
          <p className="text-center py-4">{successMessage}</p>
          <div className="flex justify-center">
            <Button onClick={() => setSuccessMessage(null)}>
              {tCommon("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Message Dialog */}
      <Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              เกิดข้อผิดพลาด / Error
            </DialogTitle>
          </DialogHeader>
          <p className="text-center py-4">{errorMessage}</p>
          <div className="flex justify-center">
            <Button variant="destructive" onClick={() => setErrorMessage(null)}>
              {tCommon("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
