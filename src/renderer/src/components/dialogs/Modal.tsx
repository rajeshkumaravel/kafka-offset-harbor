import { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  footer?: React.ReactNode
  wide?: boolean
  danger?: boolean
  children: React.ReactNode
}

export default function Modal({ title, onClose, footer, wide, danger, children }: Props): React.JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}${danger ? ' danger-modal' : ''}`}>
        <div className="modal-header">
          {title}
          <button className="btn small ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
