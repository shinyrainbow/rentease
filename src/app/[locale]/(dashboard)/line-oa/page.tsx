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

interface LineContact {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  projectId: string;
  project: { name: string; nameTh: string | null };
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
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [slipMessageId, setSlipMessageId] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [savingSlip, setSavingSlip] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Array<{ id: string; invoiceNo: string; totalAmount: number; paidAmount: number }>>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    lineChannelId: "",
    lineChannelSecret: "",
    lineAccessToken: "",
  });

  // Track expanded/collapsed state for each project in chat list
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Group contacts by project
  const contactsByProject = contacts.reduce((acc, contact) => {
    const projectId = contact.projectId;
    if (!acc[projectId]) {
      acc[projectId] = {
        project: contact.project,
        contacts: [],
      };
    }
    acc[projectId].contacts.push(contact);
    return acc;
  }, {} as Record<string, { project: { name: string; nameTh: string | null }; contacts: LineContact[] }>);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Initialize all projects as expanded on first load
  useEffect(() => {
    if (contacts.length > 0 && expandedProjects.size === 0) {
      const allProjectIds = new Set(contacts.map((c) => c.projectId));
      setExpandedProjects(allProjectIds);
    }
  }, [contacts]);

  const fetchData = async () => {
    try {
      const [projectsRes, contactsRes, tenantsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/line/contacts"),
        fetch("/api/tenants?status=ACTIVE"),  // Filter by contract end date
      ]);
      const [projectsData, contactsData, tenantsData] = await Promise.all([
        projectsRes.json(),
        contactsRes.json(),
        tenantsRes.json(),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
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

  const handleEditSettings = (project: Project) => {
    setEditingProject(project);
    setFormData({
      lineChannelId: project.lineChannelId || "",
      lineChannelSecret: project.lineChannelSecret || "",
      lineAccessToken: project.lineAccessToken || "",
    });
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsSettingsOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error updating LINE settings:", error);
    } finally {
      setSavingSettings(false);
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

  const isConnected = (project: Project) => {
    return project.lineChannelId && project.lineChannelSecret && project.lineAccessToken;
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

  // Filter tenants for the selected contact's project
  const projectTenants = selectedContact
    ? tenants.filter((t) => t.unit.projectId === selectedContact.projectId)
    : [];

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
                      {Object.entries(contactsByProject).map(([projectId, { project, contacts: projectContacts }]) => (
                        <div key={projectId} className="border-b last:border-b-0">
                          {/* Project Header - Collapsible */}
                          <div
                            className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted transition-colors sticky top-0 z-10"
                            onClick={() => toggleProjectExpanded(projectId)}
                          >
                            {expandedProjects.has(projectId) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex-1 flex items-center justify-between">
                              <span className="font-medium text-sm">{project.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {projectContacts.length}
                              </Badge>
                            </div>
                          </div>

                          {/* Project Contacts */}
                          {expandedProjects.has(projectId) && (
                            <div className="divide-y">
                              {projectContacts.map((contact) => (
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
                                        {contact.tenant && (
                                          <Badge variant="secondary" className="text-xs">
                                            {contact.tenant.name}
                                          </Badge>
                                        )}
                                      </div>
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
                        <CardTitle className="text-base">{selectedContact.displayName}</CardTitle>
                        <CardDescription className="text-xs">
                          {selectedContact.tenant ? (
                            <span className="text-green-600">
                              Linked: {selectedContact.tenant.name}
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
                                        : `/api/line/image/${msg.mediaUrl}?projectId=${selectedContact.projectId}`}
                                      alt="LINE Image"
                                      className="max-w-48 max-h-48 rounded-lg cursor-pointer hover:opacity-90 object-cover bg-muted"
                                      loading="lazy"
                                      onClick={() => window.open(
                                        msg.direction === "OUTGOING"
                                          ? msg.mediaUrl!
                                          : `/api/line/image/${msg.mediaUrl}?projectId=${selectedContact.projectId}`,
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
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  LINE Official Account Integration
                </CardTitle>
                <CardDescription>
                  Configure LINE OA settings for each project to enable automated messaging
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.lineChannelId || "Not configured"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {isConnected(project) ? (
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
                        <Button variant="outline" size="sm" onClick={() => handleEditSettings(project)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("settings")} - {editingProject?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
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
                  {projectTenants.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No active tenants in {selectedContact?.project.name}
                    </div>
                  ) : (
                    projectTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} - {tenant.unit.unitNumber}
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
                  src={`/api/line/image/${slipMessageId}?projectId=${selectedContact.projectId}`}
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
                    unpaidInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNo} - ฿{(invoice.totalAmount - invoice.paidAmount).toLocaleString()}
                      </SelectItem>
                    ))
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
