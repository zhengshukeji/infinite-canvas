import { Button } from "@infinite-canvas/plugin-sdk/ui/button";
import { Input } from "@infinite-canvas/plugin-sdk/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@infinite-canvas/plugin-sdk/ui/select";
import { toast } from "sonner";
import type { ModelChannel } from "@infinite-canvas/shared/channels";
import { createModelChannel, createModelGroup, normalizeChannelModels, updateChannels, useConfigStore } from "@workbench/stores/use-config-store";
import { workbenchMessageOptions } from "@workbench/components/ui/sonner";
import { ChannelEditorPanel } from "./channel-editor-panel";
import { ChannelRemoveConfirmation } from "./channel-remove-confirmation";
import styles from "./app-config-modal.module.css";
import "./config-network.css";

export function ConfigChannels({ signal }: { signal: AbortSignal }) {
    const config = useConfigStore((state) => state.config);
    const requestedSelection = useConfigStore((state) => state.configSelection);
    const channels = config.channels;
    const selectedChannel = channels.find((channel) => channel.id === requestedSelection.channelId) ?? channels[0];
    const groupId = selectedChannel?.groups.find((group) => group.id === requestedSelection.groupId)?.id ?? selectedChannel?.groups[0]?.id;
    // 只有当前渠道真正有了模型才切到分组与模型列表；名称、地址、密钥的变化都留在新建渠道视图。
    const newChannel = Boolean(selectedChannel && !selectedChannel.groups.some((group) => group.models.length));
    const saveChannels = (next: ModelChannel[]) => {
        if (signal.aborted) return;
        void updateChannels(next).catch(() => {
            if (!signal.aborted) toast.error("渠道尚未保存，请检查连接后重新修改，或刷新后重试。", { ...workbenchMessageOptions.error, id: "channel-save" });
        });
    };
    const updateChannel = (channel: ModelChannel) => {
        const next = { ...channel, groups: channel.groups.map((group) => ({ ...group, models: normalizeChannelModels(group.models) })) };
        saveChannels(useConfigStore.getState().config.channels.map((item) => item.id === channel.id ? next : item));
    };
    const addChannel = () => {
        const channel = createModelChannel({ name: `渠道 ${channels.length + 1}` });
        saveChannels([...channels, channel]);
        useConfigStore.setState({ configSelection: { tab: "builtin:channels", channelId: channel.id, groupId: channel.groups[0]?.id } });
    };
    const addGroup = (channel: ModelChannel) => {
        const group = createModelGroup({ name: `分组 ${channel.groups.length + 1}` });
        updateChannel({ ...channel, groups: [...channel.groups, group] });
        useConfigStore.setState({ configSelection: { tab: "builtin:channels", channelId: channel.id, groupId: group.id } });
    };
    const deleteChannel = (id: string) => {
        if (channels.length <= 1 && channels.some((channel) => channel.id === id)) {
            toast.warning("至少保留一个渠道", workbenchMessageOptions.warning);
            return;
        }
        saveChannels(channels.filter((channel) => channel.id !== id));
        if (selectedChannel?.id === id) useConfigStore.setState({ configSelection: { tab: "builtin:channels" } });
    };
    const deleteGroup = (channel: ModelChannel, id: string) => {
        const groups = channel.groups.filter((group) => group.id !== id);
        updateChannel({ ...channel, groups });
        if (selectedChannel?.id === channel.id && groupId === id) useConfigStore.setState({ configSelection: { tab: "builtin:channels", channelId: channel.id, groupId: groups[0]?.id } });
    };

    const chooseChannel = (id: string) => useConfigStore.setState({ configSelection: { tab: "builtin:channels", channelId: id, groupId: channels.find((channel) => channel.id === id)!.groups[0]?.id } });
    const chooseGroup = (id: string) => useConfigStore.setState({ configSelection: { tab: "builtin:channels", channelId: selectedChannel!.id, groupId: id } });
    return <div className={`${styles.channels} flex min-h-0 flex-1 flex-col`}>
        <div data-channel-navigation className="settings-network generation-workspace-controls shrink-0 border-b border-(--channel-line) p-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between text-xs"><span>渠道</span><Button type="button" variant="ghost" size="xs" aria-label="新增渠道" className="w-6 px-0!" onClick={addChannel}><Plus aria-hidden className="size-3.5" /></Button></div>
            <div className="flex items-center gap-2">
                <Select value={selectedChannel?.id} onValueChange={chooseChannel}>
                    <SelectTrigger aria-label="选择渠道" className={styles.channelSelect}><SelectValue placeholder="选择渠道" /></SelectTrigger>
                    <SelectContent>{channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}</SelectContent>
                </Select>
                {selectedChannel && <RemoveNavigationItem key={selectedChannel.id} title="删除渠道" label={`删除渠道 ${selectedChannel.name}`} question={`删除渠道「${selectedChannel.name}」及全部分组？`} onConfirm={() => deleteChannel(selectedChannel.id)} />}
            </div>
        </div>
        <div className="flex min-h-0 flex-1">
            <div data-channel-navigation className="settings-network generation-workspace-controls hidden w-44 shrink-0 flex-col border-r border-(--channel-line) lg:flex">
                <div className="flex h-14 shrink-0 items-center justify-between px-4"><h2 className="m-0 text-sm font-semibold">渠道</h2><Button type="button" variant="ghost" size="xs" className="w-6 px-0!" aria-label="新增渠道" title="新增渠道" onClick={addChannel}><Plus aria-hidden className="size-4" /></Button></div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-3">
                    {channels.map((channel) => <div key={channel.id} className={styles.channelOption} data-active={selectedChannel?.id === channel.id}>
                        <button type="button" className={`${styles.channelName} cursor-pointer py-2 text-left text-sm font-medium`} aria-current={selectedChannel?.id === channel.id} title={channel.name} onClick={() => chooseChannel(channel.id)}>{channel.name}</button>
                        <RemoveNavigationItem compact title="删除渠道" label={`删除渠道 ${channel.name}`} question={`删除渠道「${channel.name}」及全部分组？`} onConfirm={() => deleteChannel(channel.id)} />
                    </div>)}
                </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {selectedChannel ? <div className="settings-network generation-workspace-controls shrink-0 border-b border-(--channel-line) p-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <label className="grid min-w-0 gap-1.5 text-xs font-medium">渠道名称<Input className="settings-network-field text-sm! font-normal!" value={selectedChannel.name} onChange={(event) => updateChannel({ ...selectedChannel, name: event.target.value })} /></label>
                        <label className="grid min-w-0 gap-1.5 text-xs font-medium">服务地址<Input className="settings-network-field text-sm! font-normal!" value={selectedChannel.baseUrl} onChange={(event) => updateChannel({ ...selectedChannel, baseUrl: event.target.value })} placeholder="https://api.example.com" /></label>
                    </div>
                </div> : null}
                {!newChannel ? <div data-channel-navigation className="settings-network generation-workspace-controls shrink-0 border-b border-(--channel-line) p-3 lg:hidden">
                    <div className="mb-2 flex items-center justify-between text-xs"><span>Key 分组</span><Button type="button" variant="ghost" size="xs" className="w-6 px-0!" aria-label="新增分组" disabled={!selectedChannel} onClick={() => addGroup(selectedChannel!)}><Plus aria-hidden className="size-3.5" /></Button></div>
                    <div className="flex items-center gap-2">
                        <Select value={groupId} onValueChange={chooseGroup} disabled={!selectedChannel}>
                            <SelectTrigger aria-label="选择 Key 分组" className={styles.channelSelect}><SelectValue placeholder="选择分组" /></SelectTrigger>
                            <SelectContent>{(selectedChannel?.groups ?? []).map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {selectedChannel && groupId && <RemoveNavigationItem key={groupId} title="删除分组" label="删除当前分组" question="删除此分组及其中的模型？" onConfirm={() => deleteGroup(selectedChannel, groupId)} />}
                    </div>
                </div> : null}
                <div className="flex min-h-0 flex-1">
                    {!newChannel ? <div data-channel-navigation className="settings-network generation-workspace-controls hidden w-40 shrink-0 flex-col border-r border-(--channel-line) lg:flex">
                        <div className="flex h-14 shrink-0 items-center justify-between px-4"><h2 className="m-0 text-sm font-semibold">Key 分组</h2><Button type="button" variant="ghost" size="xs" className="w-6 px-0!" aria-label="新增分组" title="新增分组" disabled={!selectedChannel} onClick={() => addGroup(selectedChannel!)}><Plus aria-hidden className="size-4" /></Button></div>
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-3">
                            {selectedChannel ? <>
                                {selectedChannel.groups.map((group) => <div key={group.id} className={styles.channelOption} data-active={groupId === group.id}>
                                    <button type="button" className={`${styles.channelName} cursor-pointer py-2 text-left text-sm`} aria-current={groupId === group.id} title={group.name} onClick={() => chooseGroup(group.id)}>{group.name}</button>
                                    <RemoveNavigationItem compact title="删除分组" label={`删除分组 ${group.name}`} question={`删除分组「${group.name}」及其中的模型？`} onConfirm={() => deleteGroup(selectedChannel, group.id)} />
                                </div>)}
                                {!selectedChannel.groups.length ? <p className="px-2 text-xs text-muted-foreground">点击 + 新增分组</p> : null}
                            </> : <p className="px-2 text-xs text-muted-foreground">请先选择渠道</p>}
                        </div>
                    </div> : null}
                    <div className="min-h-0 min-w-0 flex-1">
                        {selectedChannel ? <ChannelEditorPanel key={`${selectedChannel.id}:${groupId ?? ""}`} channel={selectedChannel} groupId={groupId} onChange={updateChannel} newChannel={newChannel} /> : <div className="flex h-full flex-col">
                            <h2 className="m-0 flex h-14 shrink-0 items-center border-b border-(--channel-line) px-4 text-sm font-semibold">模型</h2>
                            <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">选择渠道和分组，管理模型及调用方式。</div>
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    </div>;
}

function RemoveNavigationItem({ title, label, question, compact, onConfirm }: { title: string; label: string; question: string; compact?: boolean; onConfirm: () => void }) {
    return <ChannelRemoveConfirmation question={question} onConfirm={onConfirm}>
        <Button type="button" variant="ghost" size={compact ? "xs" : "default"} aria-label={label} title={title}
            className={`${styles.channelDelete} ${compact ? "w-6" : "w-8"} px-0!`}><Trash2 aria-hidden className={compact ? "size-3.5" : "size-4"} /></Button>
    </ChannelRemoveConfirmation>;
}
