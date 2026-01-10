import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function PatientCard({
  patient,
  isExpanded,
  isDoctorHere,
  doctorReply,
  onToggle,
  onChairClick,
  onCallDoctor,
  onStatusChange,
  onStaffMode,
  onExitStaffMode,
  onDoctorLocationUpdate,
  onConsultingMode,
  onMoveToConsulting,
  onCancelConsultingWaiting,
  onStartConsulting,
  onMoveToRecovery,
  onExitRecovery,
  isReadOnly = false,
  allowCallPatient = true,
  isStaffTab = false,
  isConsultingTab = false,
  isRecoveryTab = false,
  isCallingDoctor = false
}) {
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: patient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const isWaiting = patient.status === 'waiting';
  const isTreating = patient.status === 'treatmenting';
  const isStaffMode = patient.is_staff_mode;
  const isRecoveryRoom = patient.is_recovery_room;
  const isConsultingMode = patient.is_consulting_mode;
  const isConsultingWaiting = isConsultingMode && !patient.consulting_actual_start_time;
  const isConsultingActive = isConsultingMode && patient.consulting_actual_start_time;

  // 상담대기 시간 계산
  const getConsultingWaitingMinutes = () => {
    if (!isConsultingWaiting || !patient.consulting_start_time) return 0;
    const diffMs = Date.now() - patient.consulting_start_time;
    return diffMs > 0 ? Math.floor(diffMs / (60 * 1000)) : 0;
  };

  // 상태별 색상
  const getStatusColor = () => {
    if (isRecoveryRoom) return '#a78bfa'; // 보라 (회복실)
    if (isConsultingMode) return '#ec4899'; // 핑크 (상담)
    if (isStaffMode) return '#ec4899'; // 핑크
    if (isTreating) return '#10b981'; // 녹색
    return '#f59e0b'; // 대기 - 주황
  };

  const getStatusText = () => {
    if (isRecoveryRoom) return '회복중';
    if (isConsultingWaiting) return '상담대기';
    if (isConsultingActive) return '상담중';
    if (isStaffMode) return '스텝';
    if (isTreating) return '진료중';
    return '대기';
  };

  // 24시간 형식 시간 표시 - 예약/당일 구분
  const getTimeDisplay = () => {
    try {
      if (patient.reservation_time) {
        let timeStr = '';
        // Date 객체로 변환 시도
        const date = new Date(patient.reservation_time);
        if (!isNaN(date.getTime())) {
          timeStr = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        } else {
          // 문자열 형식 처리
          const time = String(patient.reservation_time);
          if (time.includes(':')) {
            timeStr = time.substring(0, 5);
          } else if (/^\d{4}$/.test(time)) {
            timeStr = `${time.substring(0, 2)}:${time.substring(2, 4)}`;
          } else {
            timeStr = time;
          }
        }
        return { type: '예약', time: timeStr };
      }

      // start_time 또는 created_at 사용 (당일 접수)
      const fallbackTime = patient.start_time || patient.created_at;
      if (fallbackTime) {
        const timeStr = new Date(fallbackTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        return { type: '당일', time: timeStr };
      }
    } catch (err) {
      console.error('Error getting time display:', err);
    }
    return { type: '', time: '' };
  };

  const handleStepOrDoctor = (e) => {
    e.stopPropagation();
    if (isStaffMode) {
      onExitStaffMode(patient.id);
    } else if (isTreating) {
      onStaffMode(patient.id);
    }
  };

  const handleComplete = (e) => {
    e.stopPropagation();
    onStatusChange(patient.id, 'completed');
  };

  const handleCardClick = () => {
    if (onToggle) {
      onToggle();
    }
  };

  // 이름 클릭 시 의사 위치 토글
  const handleNameClick = (e) => {
    e.stopPropagation();
    if (onDoctorLocationUpdate) {
      onDoctorLocationUpdate(patient.id);
    }
  };

  // 상태 라벨 우클릭 시 드롭다운 표시 (읽기전용 모드에서는 비활성화)
  const handleStatusContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setShowStatusMenu(true);
  };

  // 상태 변경 처리
  const handleStatusSelect = (newStatus) => {
    setShowStatusMenu(false);
    if (newStatus === 'staff') {
      onStaffMode(patient.id);
    } else if (newStatus === 'doctor') {
      onExitStaffMode(patient.id);
    } else {
      onStatusChange(patient.id, newStatus);
    }
  };

  // 상담 시작 시간 포맷
  const getConsultingStartTimeDisplay = () => {
    if (!patient.consulting_actual_start_time) return '';
    return new Date(patient.consulting_actual_start_time).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // 상담탭 전용 레이아웃
  if (isConsultingTab && isConsultingMode) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          background: 'rgba(30, 30, 30, 0.9)',
          borderRadius: '12px',
          border: '2px solid #ec4899',
          padding: '12px',
          gap: '8px',
          cursor: isConsultingWaiting ? 'grab' : 'default',
          position: 'relative',
          overflow: 'visible'
        }}
        {...attributes}
        {...(isConsultingWaiting ? listeners : {})}
        onClick={handleCardClick}
      >
        {/* 상담중일 때 말풍선 아이콘 */}
        {isConsultingActive && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              left: '-8px',
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #f472b6, #ec4899)',
              border: '3px solid white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.5)',
              zIndex: 10,
              animation: 'pulse 2s infinite',
              fontSize: '18px'
            }}
          >
            💬
          </div>
        )}

        {/* 첫번째 줄: 이름 + 상담시간 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingLeft: isConsultingActive ? '32px' : '0'
        }}>
          {/* 이름 + 신환/VIP */}
          <span
            style={{
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#fff',
              wordBreak: 'keep-all',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1
            }}
          >
            {patient.is_vip && <span style={{ marginRight: '2px' }}>⭐</span>}
            {patient.name}
            {patient.is_new_patient && (
              <span style={{
                marginLeft: '4px',
                fontSize: '10px',
                color: '#f472b6',
                fontWeight: 'bold'
              }}>신환</span>
            )}
          </span>

          {/* 상담대기/상담중 시간 표시 */}
          <span style={{
            fontSize: '13px',
            color: '#ec4899',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            {isConsultingWaiting
              ? `상담대기 ${getConsultingWaitingMinutes()}분`
              : `상담시작 ${getConsultingStartTimeDisplay()}`
            }
          </span>
        </div>

        {/* 메모만 표시 (예약내용 제외) */}
        {isExpanded && patient.staff_notes && (
          <div style={{
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            marginTop: '4px'
          }}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: patient.note_emphasized ? 'bold' : 'normal',
              color: patient.note_emphasized ? '#ff4444' : '#e5e5e5',
              lineHeight: 1.4,
              wordBreak: 'keep-all'
            }}>
              {patient.note_emphasized ? '⚠️ ' : '📝 '}{patient.staff_notes}
            </div>
          </div>
        )}

        {/* 축소 상태: 메모 한줄 미리보기 */}
        {!isExpanded && patient.staff_notes && (
          <div style={{
            fontSize: '12px',
            color: '#f472b6',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            📝 {patient.staff_notes}
          </div>
        )}

        {/* 상담대기: 대기취소/상담시작 버튼 */}
        {isConsultingWaiting && (
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '4px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelConsultingWaiting?.(patient.id);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 'bold',
                background: 'rgba(156, 163, 175, 0.2)',
                border: '1px solid #9ca3af',
                borderRadius: '6px',
                color: '#9ca3af',
                cursor: 'pointer'
              }}
            >
              대기취소
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartConsulting?.(patient.id);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 'bold',
                background: 'rgba(236, 72, 153, 0.2)',
                border: '1px solid #ec4899',
                borderRadius: '6px',
                color: '#f472b6',
                cursor: 'pointer'
              }}
            >
              상담시작
            </button>
          </div>
        )}
      </div>
    );
  }

  // 일반 레이아웃 (상담탭 외)
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: 'rgba(30, 30, 30, 0.9)',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.1)',
        padding: '12px',
        gap: '8px',
        cursor: 'grab',
        position: 'relative',
        overflow: 'visible'
      }}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
    >
      {/* 의사 위치 표시 - 좌측 상단 원형 뱃지 (원본 프로젝트 스타일) */}
      {isDoctorHere && !isStaffMode && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: '-8px',
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: '3px solid white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.5)',
            zIndex: 10,
            animation: 'pulse 2s infinite',
            overflow: 'hidden'
          }}
        >
          <img src="./dentist.png" alt="의사" style={{ width: '28px', height: '28px', objectFit: 'cover' }} />
        </div>
      )}

      {/* 스텝 모드 아이콘 */}
      {isStaffMode && isTreating && !isRecoveryRoom && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: '-8px',
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
            border: '3px solid white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.5)',
            zIndex: 10,
            animation: 'pulse 2s infinite',
            overflow: 'hidden'
          }}
        >
          <img src="./patient_female.png" alt="스텝" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />
        </div>
      )}

      {/* 원장 회신 표시 - 우측 상단 오버레이 */}
      {doctorReply && !isStaffMode && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: '3px solid white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.5)',
            zIndex: 10,
            animation: 'pulse 1s infinite'
          }}
        >
          {doctorReply.reply === '갈게요' ? '🏃' :
           doctorReply.reply === '5분후' ? '⏰5' :
           doctorReply.reply === '10분후' ? '⏰10' :
           doctorReply.reply === '확인' ? '✅' :
           '💬'}
        </div>
      )}

      {/* 첫번째 줄: 체어번호 + 상태 + 이름 + 시간 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        paddingLeft: (isDoctorHere || isStaffMode) ? '32px' : '0'
      }}>
        {/* 체어번호 - 클릭 시 체어 선택 (회복실 환자는 비활성화) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onChairClick && !isRecoveryRoom) {
              onChairClick(patient.id, patient.chair_number);
            }
          }}
          style={{
            fontSize: '1.8rem',
            fontWeight: 'bold',
            color: isRecoveryRoom ? '#666' : (patient.chair_number ? '#10b981' : '#666'),
            minWidth: '40px',
            textAlign: 'center',
            cursor: isRecoveryRoom ? 'default' : 'pointer',
            padding: '4px',
            borderRadius: '8px',
            transition: 'background 0.2s',
            opacity: isRecoveryRoom ? 0.5 : 1
          }}
        >
          {patient.chair_number || '-'}
        </div>

        {/* 상태 뱃지 - 우클릭 시 드롭다운 */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span
            onContextMenu={handleStatusContextMenu}
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '3px 8px',
              borderRadius: '999px',
              background: `${getStatusColor()}33`,
              color: getStatusColor(),
              border: `1px solid ${getStatusColor()}55`,
              cursor: 'context-menu'
            }}
          >
            {getStatusText()}
          </span>

          {/* 상태 변경 드롭다운 */}
          {showStatusMenu && (
            <>
              <div
                onClick={() => setShowStatusMenu(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 99
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#2d2d2d',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 100,
                  minWidth: '100px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusSelect('waiting'); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: patient.status === 'waiting' && !isStaffMode ? '#f59e0b33' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  대기
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusSelect('treatmenting'); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: isTreating && !isStaffMode ? '#10b98133' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#10b981',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  진료중
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusSelect('completed'); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  완료
                </button>
                {/* 상담/회복실 옵션 */}
                {!isConsultingMode && !isRecoveryRoom && (
                  <>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatusMenu(false);
                        onMoveToConsulting?.(patient.id);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#f472b6',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      💬 상담
                    </button>
                  </>
                )}
                {isTreating && !isRecoveryRoom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStatusMenu(false);
                      onMoveToRecovery?.(patient.id);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#a78bfa',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    🛏️ 회복실
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* 이름 + 신환/VIP - 클릭 시 의사 위치 토글 */}
        <span
          onClick={handleNameClick}
          style={{
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#fff',
            wordBreak: 'keep-all',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          {patient.is_vip && <span style={{ marginRight: '2px' }}>⭐</span>}
          {patient.name}
          {patient.is_new_patient && (
            <span style={{
              marginLeft: '4px',
              fontSize: '10px',
              color: '#f472b6',
              fontWeight: 'bold'
            }}>신환</span>
          )}
        </span>

        {/* 시간 - 예약/당일 구분 표시 */}
        {(() => {
          const timeInfo = getTimeDisplay();
          if (!timeInfo.time) return null;
          return (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: timeInfo.type === '예약' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)',
              padding: '4px 10px',
              borderRadius: '8px',
              border: `1px solid ${timeInfo.type === '예약' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`,
              flexShrink: 0
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: timeInfo.type === '예약' ? '#60a5fa' : '#fb923c',
                letterSpacing: '0.5px'
              }}>
                {timeInfo.type}
              </span>
              <span style={{
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#fff',
                fontFamily: 'monospace',
                letterSpacing: '1px'
              }}>
                {timeInfo.time}
              </span>
            </div>
          );
        })()}
      </div>


      {/* 확장된 상태: 예약내용과 메모 표시 */}
      {isExpanded && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          marginTop: '4px'
        }}>
          {/* 예약내용 */}
          {patient.request_detail && (
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'normal',
              color: '#e5e5e5',
              lineHeight: 1.4,
              wordBreak: 'keep-all'
            }}>
              📋 {patient.request_detail}
            </div>
          )}

          {/* 진료메모 - 강조모드 지원 */}
          {patient.staff_notes && (
            <div style={{
              fontSize: '1.5rem',
              fontWeight: patient.note_emphasized ? 'bold' : 'normal',
              color: patient.note_emphasized ? '#ff4444' : '#e5e5e5',
              lineHeight: 1.4,
              wordBreak: 'keep-all'
            }}>
              {patient.note_emphasized ? '⚠️ ' : '📝 '}{patient.staff_notes}
            </div>
          )}

          {/* 내용이 없는 경우 */}
          {!patient.request_detail && !patient.staff_notes && (
            <div style={{
              fontSize: '1.1rem',
              color: '#666',
              textAlign: 'center'
            }}>
              예약내용/메모 없음
            </div>
          )}
        </div>
      )}

      {/* 축소된 상태: 예약내용 한줄 미리보기 */}
      {!isExpanded && patient.request_detail && (
        <div style={{
          fontSize: '12px',
          color: '#67e8f9',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          📋 {patient.request_detail}
        </div>
      )}

      {/* 버튼 영역 */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        marginTop: '4px',
        alignItems: 'center'
      }}>
        {/* 원장 호출 버튼 - 스텝모드/상담탭 아닐 때만 */}
        {allowCallPatient && isTreating && !isStaffMode && patient.chair_number && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isCallingDoctor) {
                onCallDoctor(patient.id, patient.name, patient.chair_number, patient.doctor_id, patient.request_detail, patient.staff_notes);
              }
            }}
            disabled={isCallingDoctor}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: isCallingDoctor
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(245, 158, 11, 0.2)',
              border: isCallingDoctor
                ? '1px solid #10b981'
                : '1px solid #f59e0b',
              borderRadius: '6px',
              color: isCallingDoctor ? '#34d399' : '#fbbf24',
              cursor: isCallingDoctor ? 'default' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {isCallingDoctor ? '✓ 호출됨' : '🔔 원장'}
          </button>
        )}

        {/* 대기 환자: 진료시작 버튼 (읽기전용 모드 아닐 때만) */}
        {!isReadOnly && isWaiting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(patient.id, 'treatmenting');
            }}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              borderRadius: '6px',
              color: '#34d399',
              cursor: 'pointer'
            }}
          >
            진료시작
          </button>
        )}

        {/* 대기 환자: 상담하기 버튼 (읽기전용 모드 아닐 때만) */}
        {!isReadOnly && isWaiting && onConsultingMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConsultingMode(patient.id);
            }}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid #a855f7',
              borderRadius: '6px',
              color: '#c084fc',
              cursor: 'pointer'
            }}
          >
            상담하기
          </button>
        )}

        {/* 스텝/의사/회복실/완료 버튼 - 탭에 따라 다르게 표시 */}
        {isTreating && (
          isRecoveryTab ? (
            // 회복실탭: 진료/완료 버튼
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExitRecovery?.(patient.id, 'waiting');
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  color: '#fbbf24',
                  cursor: 'pointer'
                }}
              >
                🏥 진료
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExitRecovery?.(patient.id, 'completed');
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#34d399',
                  cursor: 'pointer'
                }}
              >
                ✓ 완료
              </button>
            </>
          ) : isStaffTab ? (
            // 스텝탭: 의사/완료 버튼
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onExitStaffMode(patient.id); }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#34d399',
                  cursor: 'pointer'
                }}
              >
                👨‍⚕️ 의사
              </button>
              <button
                onClick={handleComplete}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#34d399',
                  cursor: 'pointer'
                }}
              >
                ✓ 완료
              </button>
            </>
          ) : (
            // 일반탭: 스텝/의사 + 완료 버튼
            <>
              <button
                onClick={handleStepOrDoctor}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: isStaffMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                  border: `1px solid ${isStaffMode ? '#3b82f6' : '#ec4899'}`,
                  borderRadius: '6px',
                  color: isStaffMode ? '#60a5fa' : '#f472b6',
                  cursor: 'pointer'
                }}
              >
                {isStaffMode ? '👨‍⚕️ 의사' : '👩‍⚕️ 스텝'}
              </button>
              <button
                onClick={handleComplete}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#34d399',
                  cursor: 'pointer'
                }}
              >
                ✓ 완료
              </button>
            </>
          )
        )}

      </div>
    </div>
  );
}

export default PatientCard;
