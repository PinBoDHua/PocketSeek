import clsx from 'clsx'
import { memo, useRef, useState, type ReactNode } from 'react'
import {
  IconChartOutline16,
  IconDarkOutline16,
  IconDataOutline16,
  IconDownloadOutline16,
  IconFollowsystemOutline16,
  IconLightOutline16,
  IconPromptOutline16,
  IconSettingsOutline16,
  IconUploadOutline14,
} from '../base/icons.js'
import {
  BackupError,
  clearHistory,
  exportHistory,
  importHistory,
} from '../../services/chat/backup.js'
import { useIsMobile } from '../../app/viewport.js'
import { useChatStore } from '../../services/chat/store.js'
import { IconInfoOutline16, IconInstallOutline16 } from '../base/brandIcons.js'
import { usePwaInstall } from '../../pwa.js'
import type { ChatModel, ThinkEffort } from '../../services/api/types.js'
import {
  setEffort,
  setMessageWidth,
  setModel,
  setReadFontSize,
  setReadLineHeight,
  setShowUsage,
  setThemePreference,
  setTtsVoice,
  useSettings,
  type MessageWidth,
  type ReadFontSize,
  type ReadLineHeight,
  type ThemePreference,
} from '../../services/settings.js'
import { useTranslate, type TranslationKey, type TranslationMessage } from '../../i18n/index.js'
import { BrandMark } from '../base/BrandMark.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { Select } from '../base/Select.js'
import { showToast } from '../base/toastState.js'
import { ApiKeyConfirm, ApiKeyField, useApiKeyEditor } from './ApiKeyField.js'
import { closeSettings, useSettingsDialog, type SettingsSection } from './settingsDialogState.js'
import { PromptsPanel } from './PromptsPanel.js'
import { UsagePanel } from './UsagePanel.js'
import styles from './Settings.module.css'

/**
 * 设置弹窗：分「通用设置」（主题、默认模型、思考强度、朗读音色、用量脚注）、
 * 「用量统计」（token、费用、近 7 天趋势）、「数据管理」（API Key、导入、导出、删除）
 * 与「关于」（版本、安装到桌面、非官方说明）。
 * 桌面端为居中弹窗、左侧导航；移动端为底部弹层、导航横排在内容上方
 */
export const SettingsDialog = memo(function SettingsDialog() {
  const open = useSettingsDialog((state) => state.open)
  return open ? <SettingsContent /> : null
})

const sections: { value: SettingsSection; label: TranslationKey; icon: ReactNode }[] = [
  {
    value: 'general',
    label: 'settingDialogAsideGeneralOptionLabel',
    icon: <IconSettingsOutline16 />,
  },
  { value: 'prompts', label: 'settingDialogAsidePromptsOptionLabel', icon: <IconPromptOutline16 /> },
  { value: 'usage', label: 'settingDialogAsideUsageOptionLabel', icon: <IconChartOutline16 /> },
  { value: 'data', label: 'settingDialogAsideDataOptionLabel', icon: <IconDataOutline16 /> },
  { value: 'about', label: 'settingDialogAsideAboutOptionLabel', icon: <IconInfoOutline16 /> },
]

const SettingsContent = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  // 打开时按调用方指定的分组选中，之后在弹窗内切换
  const [section, setSection] = useState(() => useSettingsDialog.getState().section)
  // 切换分组不丢失正在输入的 API Key 与导入状态
  const apiKeyEditor = useApiKeyEditor()
  const historyImport = useHistoryImport()
  const historyDelete = useHistoryDelete()
  const replacingHistory = useChatStore((state) => state.importingHistory)
  const historyBusy = historyImport.busy || historyDelete.busy || replacingHistory
  return (
    <>
      <Modal
        title={t('settings')}
        closable
        className={styles.dialog}
        mainClassName={styles.dialogMain}
        onClose={() => {
          if (!historyDelete.busy) {
            closeSettings()
          }
        }}
      >
        <div role="tablist" className={styles.navigation}>
          {sections.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={section === item.value}
              className={clsx(styles.navItem, section === item.value && styles.navItemActive)}
              onClick={() => setSection(item.value)}
            >
              {item.icon}
              {t(item.label)}
            </button>
          ))}
        </div>
        <div role="tabpanel" className={styles.content}>
          {section === 'general' ? (
            <>
              <ThemeSetting />
              <ReadingSettings />
              <ModelSetting />
              <EffortSetting />
              <TtsVoiceSetting />
              <ShowUsageSetting />
            </>
          ) : section === 'prompts' ? (
            <PromptsPanel />
          ) : section === 'usage' ? (
            <UsagePanel />
          ) : section === 'data' ? (
            <>
              <ApiKeyField editor={apiKeyEditor} />
              <ImportHistory historyImport={historyImport} disabled={historyBusy} />
              <ExportHistory disabled={historyBusy} />
              <SettingCell
                label={t('deleteAllSessions')}
                status={null}
                action={
                  <Button
                    variant="dangerOutlined"
                    size="m"
                    className={styles.cellButton}
                    disabled={historyBusy}
                    onClick={historyDelete.open}
                  >
                    {t('delete')}
                  </Button>
                }
              />
              {isMobile ? <ApiKeyConfirm editor={apiKeyEditor} /> : null}
            </>
          ) : (
            <AboutPanel />
          )}
        </div>
      </Modal>
      {historyImport.file ? <ImportConfirm historyImport={historyImport} /> : null}
      {historyDelete.opened ? <DeleteAllConfirm historyDelete={historyDelete} /> : null}
    </>
  )
}

/** 删除确认保留在设置之上；失败可重试，成功只关闭确认弹窗。 */
const DeleteAllConfirm = ({
  historyDelete,
}: {
  historyDelete: ReturnType<typeof useHistoryDelete>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('deleteAllSessionsModalTitle')}
      className={styles.deleteConfirm}
      onClose={historyDelete.cancel}
      footer={
        <div className={styles.deleteActions} aria-busy={historyDelete.busy}>
          <Button
            variant="outlined"
            autoFocus
            disabled={historyDelete.busy}
            onClick={historyDelete.cancel}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={historyDelete.busy}
            onClick={() => void historyDelete.confirm()}
          >
            {t(historyDelete.busy ? 'historyDeleting' : 'deleteAllSessions')}
          </Button>
        </div>
      }
    >
      {t('deleteAllSessionsModalDescription')}
    </Modal>
  )
}

const useHistoryDelete = () => {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const deleting = useRef(false)

  const confirm = async () => {
    if (deleting.current) {
      return
    }
    deleting.current = true
    setBusy(true)
    try {
      await clearHistory()
      setOpened(false)
      showToast({ key: 'historyDeleted' })
    } catch {
      showToast({ key: 'historyDeleteFailed', type: 'error' })
    } finally {
      deleting.current = false
      setBusy(false)
    }
  }

  return {
    opened,
    busy,
    open: () => setOpened(true),
    cancel: () => {
      if (!deleting.current) {
        setOpened(false)
      }
    },
    confirm,
  }
}

/** 阅读体验：正文字号、行距、消息宽度（只影响本地显示） */
const ReadingSettings = () => {
  const t = useTranslate()
  const readFontSize = useSettings((state) => state.readFontSize)
  const readLineHeight = useSettings((state) => state.readLineHeight)
  const messageWidth = useSettings((state) => state.messageWidth)
  return (
    <div className={styles.reading}>
      <div className={styles.readingTitle}>{t('settingsReading')}</div>
      <SettingCell
        label={t('settingsFontSize')}
        status={null}
        action={
          <Select<ReadFontSize>
            ariaLabel={t('settingsFontSize')}
            value={readFontSize}
            options={[
              { value: 'small', label: t('settingsFontSizeSmall') },
              { value: 'standard', label: t('settingsFontSizeStandard') },
              { value: 'large', label: t('settingsFontSizeLarge') },
            ]}
            onChange={setReadFontSize}
          />
        }
      />
      <SettingCell
        label={t('settingsLineHeight')}
        status={null}
        action={
          <Select<ReadLineHeight>
            ariaLabel={t('settingsLineHeight')}
            value={readLineHeight}
            options={[
              { value: 'compact', label: t('settingsLineHeightCompact') },
              { value: 'standard', label: t('settingsLineHeightStandard') },
              { value: 'relaxed', label: t('settingsLineHeightRelaxed') },
            ]}
            onChange={setReadLineHeight}
          />
        }
      />
      <SettingCell
        label={t('settingsMessageWidth')}
        status={null}
        action={
          <Select<MessageWidth>
            ariaLabel={t('settingsMessageWidth')}
            value={messageWidth}
            options={[
              { value: 'compact', label: t('settingsMessageWidthCompact') },
              { value: 'standard', label: t('settingsMessageWidthStandard') },
              { value: 'wide', label: t('settingsMessageWidthWide') },
            ]}
            onChange={setMessageWidth}
          />
        }
      />
    </div>
  )
}

/** 新会话默认模型：Flash 支持图片输入，Pro 推理更强但不支持图片 */
const modelOptions: { value: ChatModel; label: TranslationKey }[] = [
  { value: 'deepseek-flash', label: 'modelFlashName' },
  { value: 'deepseek-v4-pro', label: 'modelProName' },
]

const ModelSetting = () => {
  const t = useTranslate()
  const model = useSettings((state) => state.model)
  return (
    <SettingCell
      label={t('settingsDefaultModel')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsDefaultModel')}
          value={model}
          options={modelOptions.map((option) => ({ value: option.value, label: t(option.label) }))}
          onChange={setModel}
        />
      }
    />
  )
}

const effortOptions: { value: ThinkEffort; label: TranslationKey }[] = [
  { value: 'none', label: 'effortNoneName' },
  { value: 'low', label: 'effortLowName' },
  { value: 'high', label: 'effortHighName' },
  { value: 'max', label: 'effortMaxName' },
]

const EffortSetting = () => {
  const t = useTranslate()
  const effort = useSettings((state) => state.effort)
  return (
    <SettingCell
      label={t('settingsDefaultEffort')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsDefaultEffort')}
          value={effort}
          options={effortOptions.map((option) => ({ value: option.value, label: t(option.label) }))}
          onChange={setEffort}
        />
      }
    />
  )
}

/** 回复下方的用量与估算费用脚注开关 */
const ShowUsageSetting = () => {
  const t = useTranslate()
  const showUsage = useSettings((state) => state.showUsage)
  return (
    <SettingCell
      label={t('settingsShowUsage')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsShowUsage')}
          value={showUsage ? 'on' : 'off'}
          options={[
            { value: 'on', label: t('settingsShowUsageOn') },
            { value: 'off', label: t('settingsShowUsageOff') },
          ]}
          onChange={(value) => setShowUsage(value === 'on')}
        />
      }
    />
  )
}

/** 关于：非官方声明、版本号与安装到桌面 */
const AboutPanel = () => {
  const t = useTranslate()
  const { state, install } = usePwaInstall()
  const version =
    document.querySelector('meta[name="application-version"]')?.getAttribute('content') ?? ''
  const description =
    state === 'available'
      ? t('settingsInstallHint')
      : state === 'installed'
        ? t('settingsInstalled')
        : t('settingsInstallUnavailable')
  return (
    <>
      <div className={styles.about}>
        <div className={styles.aboutBrand}>
          <BrandMark size={48} className={styles.aboutMark} />
          <div className={styles.aboutBrandText}>
            <div className={styles.aboutName}>{t('appName')}</div>
            <div className={styles.aboutVersion}>{t('settingsVersion', { version })}</div>
          </div>
        </div>
        <p className={styles.aboutText}>{t('settingsAboutDescription')}</p>
      </div>
      <SettingCell
        label={t('settingsInstallApp')}
        description={description}
        status={null}
        action={
          state === 'installed' ? (
            <span className={styles.installedTag}>{t('settingsInstalled')}</span>
          ) : (
            <Button
              variant="outlined"
              size="m"
              className={styles.cellButton}
              disabled={state !== 'available'}
              onClick={() => void install()}
            >
              <IconInstallOutline16 />
              {t('settingsInstallApp')}
            </Button>
          )
        }
      />
    </>
  )
}

/** 朗读音色：stella（海星，女声）/ tide（暗潮，男声） */
const TtsVoiceSetting = () => {
  const t = useTranslate()
  const ttsVoice = useSettings((state) => state.ttsVoice)
  return (
    <SettingCell
      label={t('settingsTtsVoice')}
      status={null}
      action={
        <Select
          ariaLabel={t('settingsTtsVoice')}
          value={ttsVoice}
          options={[
            { value: 'stella', label: t('settingsTtsVoiceStella') },
            { value: 'tide', label: t('settingsTtsVoiceTide') },
          ]}
          onChange={setTtsVoice}
        />
      }
    />
  )
}

/** 覆盖导入的二次确认，叠在设置弹窗上 */
const ImportConfirm = ({
  historyImport,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
}) => {
  const t = useTranslate()
  return (
    <Modal
      title={t('historyImportConfirmTitle')}
      className={styles.importConfirm}
      onClose={historyImport.cancel}
      footer={
        <>
          <Button variant="outlined" size="m" autoFocus onClick={historyImport.cancel}>
            {t('cancel')}
          </Button>
          <Button variant="dangerOutlined" size="m" onClick={() => void historyImport.confirm()}>
            {t('historyImportConfirm')}
          </Button>
        </>
      }
    >
      <div className={styles.importConfirmText}>{t('historyImportConfirmDescription')}</div>
    </Modal>
  )
}

const themeOptions: { value: ThemePreference; label: TranslationKey; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'avatarMenuSettingsDialogThemeSelectLightOption',
    icon: <IconLightOutline16 />,
  },
  {
    value: 'dark',
    label: 'avatarMenuSettingsDialogThemeSelectDarkOption',
    icon: <IconDarkOutline16 />,
  },
  {
    value: 'system',
    label: 'avatarMenuSettingsDialogThemeSelectSystemOption',
    icon: <IconFollowsystemOutline16 />,
  },
]

/**
 * 主题项：标题下方浅色 / 深色 / 跟随系统三个选块。
 * 与下方语言选项连续排列。
 */
const ThemeSetting = () => {
  const t = useTranslate()
  const themePreference = useSettings((state) => state.themePreference)
  const label = t('avatarMenuSettingsDialogThemeItemLabel')
  return (
    <div className={styles.theme}>
      {label}
      <div role="radiogroup" aria-label={label} className={styles.themeOptions}>
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={themePreference === option.value}
            className={clsx(
              styles.themeOption,
              themePreference === option.value && styles.themeOptionSelected
            )}
            onClick={() => setThemePreference(option.value)}
          >
            {option.icon}
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** `reason` 为失败原因的文案 key，展示时按当前语言翻译后填入 `message` 参数。 */
type Status = (TranslationMessage & { error?: boolean; reason?: TranslationKey }) | null

/** 导出失败附带原因：预期的错误用对应文案作原因，其他错误用错误信息。 */
const errorStatus = (key: TranslationKey, error: unknown): Status => ({
  key,
  ...(error instanceof BackupError
    ? { reason: error.key }
    : { params: { message: error instanceof Error ? error.message : String(error) } }),
  error: true,
})

const SettingCell = ({
  label,
  description,
  status,
  action,
  className,
}: {
  label: string
  description?: string
  status: Status
  action: ReactNode
  className?: string
}) => {
  const t = useTranslate()
  return (
    <div className={clsx(styles.cell, styles.row, className)}>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
        {status || description ? (
          <div className={clsx(styles.description, status?.error && styles.error)}>
            {status
              ? t(status.key, status.reason ? { message: t(status.reason) } : status.params)
              : description}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** 选文件后先提示覆盖；确认后才检查文件并执行导入，任何错误都提示导入失败。 */
const useHistoryImport = () => {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const importing = useRef(false)

  const confirm = async () => {
    if (!file || importing.current) {
      return
    }
    importing.current = true
    setFile(null)
    setBusy(true)
    setStatus(null)
    try {
      const count = await importHistory(file)
      setStatus({ key: count === 1 ? 'historyImportedOne' : 'historyImported', params: { count } })
    } catch {
      setStatus({ key: 'historyImportFailed', error: true })
    } finally {
      importing.current = false
      setBusy(false)
    }
  }

  return { file, busy, status, select: setFile, cancel: () => setFile(null), confirm }
}

/** 导入 = 覆盖：用选中文件替换本地全部会话与附件。 */
const ImportHistory = ({
  historyImport,
  disabled,
}: {
  historyImport: ReturnType<typeof useHistoryImport>
  disabled: boolean
}) => {
  const t = useTranslate()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <SettingCell
      label={t('historyImport')}
      description={t('historyImportDescription')}
      status={historyImport.status}
      action={
        <>
          <Button
            variant="outlined"
            size="m"
            className={clsx(styles.cellButton, styles.uploadButton)}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <IconUploadOutline14 />
            {t('upload')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                historyImport.select(file)
              }
            }}
          />
        </>
      }
    />
  )
}

/** 将全部会话及图片导出为 ZIP 文件并下载 */
const ExportHistory = ({ disabled }: { disabled: boolean }) => {
  const t = useTranslate()
  const empty = useChatStore((state) => state.sessions.length === 0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const onExport = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const { name, blob } = await exportHistory()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (error) {
      setStatus(errorStatus('historyExportFailed', error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingCell
      label={t('exportAllLabel')}
      description={t('historyExportDescription')}
      status={status}
      action={
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          disabled={disabled || busy || empty}
          onClick={() => void onExport()}
        >
          <IconDownloadOutline16 />
          {t('exportAllDownload')}
        </Button>
      }
    />
  )
}
