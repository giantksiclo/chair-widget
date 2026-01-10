import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSupabase, useDoctors, usePatients, useDoctorReplies } from '../hooks/useSupabase';
import PatientCard from './PatientCard';

function ChairModeWidget({ settings }) {
  const { supabase, isConnected } = useSupabase(settings);
  const doctors = useDoctors(supabase);
  const { patients, setPatients } = usePatients(supabase);
  const doctorReplies = useDoctorReplies(supabase, patients);

  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showChairSelect, setShowChairSelect] = useState(null); // { patientId, currentChair }
  const [callingPatientId, setCallingPatientId] = useState(null); // 호출 중인 환자 ID

  // 드래그 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  // 스텝 모드 환자 목록
  const staffModePatients = useMemo(() => {
    return patients.filter(p => p.is_staff_mode && p.status === 'treatmenting');
  }, [patients]);

  // 상담 환자 목록
  const consultingPatients = useMemo(() => {
    return patients.filter(p => p.is_consulting_mode);
  }, [patients]);

  // 회복실 환자 목록
  const recoveryPatients = useMemo(() => {
    return patients.filter(p => p.is_recovery_room);
  }, [patients]);

  // 선택된 원장의 환자 목록
  const selectedDoctorPatients = useMemo(() => {
    // 스텝 탭 선택 시
    if (selectedDoctorId === 'staff') {
      return staffModePatients.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    // 상담 탭 선택 시
    if (selectedDoctorId === 'consulting') {
      return consultingPatients.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    // 회복실 탭 선택 시
    if (selectedDoctorId === 'recovery') {
      return recoveryPatients.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    // 미분류 탭 선택 시
    if (selectedDoctorId === null) {
      return patients
        .filter(p => !p.doctor_id && !p.is_consulting_mode && !p.is_recovery_room)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    // 특정 원장 선택 시 (스텝 모드, 상담, 회복실 환자 제외)
    return patients
      .filter(p => p.doctor_id === selectedDoctorId && !(p.is_staff_mode && p.status === 'treatmenting') && !p.is_consulting_mode && !p.is_recovery_room)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [patients, selectedDoctorId, staffModePatients, consultingPatients, recoveryPatients]);

  // 원장이 원장실에 있는지 확인 (모든 환자의 current_doctor_location이 null이면 원장실)
  const isDoctorInOffice = useCallback((doctorId) => {
    if (!doctorId || doctorId === 'staff' || doctorId === 'consulting' || doctorId === 'recovery') return false;

    const doctorPatients = patients.filter(p =>
      p.doctor_id === doctorId &&
      p.status !== 'completed' &&
      !p.is_consulting_mode
    );

    // 환자가 있고, 모든 환자의 위치가 null이면 원장실에 있음
    return doctorPatients.length > 0 &&
      doctorPatients.every(p => p.current_doctor_location === null);
  }, [patients]);

  // 원장별 환자 수
  const doctorTabs = useMemo(() => {
    const tabs = [];

    // 미분류 (대기열)
    const unassignedCount = patients.filter(p => !p.doctor_id && !p.is_consulting_mode && !p.is_recovery_room).length;
    tabs.push({ id: null, name: '대기열', count: unassignedCount });

    // 각 원장 (스텝 모드, 상담, 회복실 환자 제외)
    doctors.forEach(doc => {
      const count = patients.filter(p =>
        p.doctor_id === doc.id &&
        !(p.is_staff_mode && p.status === 'treatmenting') &&
        !p.is_consulting_mode &&
        !p.is_recovery_room
      ).length;
      tabs.push({ id: doc.id, name: doc.name, count });
    });

    // 스텝 탭
    tabs.push({ id: 'staff', name: '스텝', count: staffModePatients.length });

    // 상담 탭
    tabs.push({ id: 'consulting', name: '상담', count: consultingPatients.length });

    // 회복실 탭
    tabs.push({ id: 'recovery', name: '회복실', count: recoveryPatients.length });

    // 0명인 탭 제외
    return tabs.filter(tab => tab.count > 0);
  }, [doctors, patients, staffModePatients.length, consultingPatients.length, recoveryPatients.length]);

  // 원장 호출
  const handleCallDoctor = useCallback(async (patientId, patientName, chairNumber, doctorId, requestDetail, staffNotes) => {
    if (!supabase) return;

    // 호출 시작 상태 설정
    setCallingPatientId(patientId);

    const doctor = doctors.find(d => d.id === doctorId);
    const doctorName = doctor?.name ? `${doctor.name} 원장님` : '원장님';

    let message = `${doctorName} ${chairNumber}번 체어에 ${patientName}님 진료부탁드립니다`;
    if (requestDetail) message += `\n예약내용: ${requestDetail}`;
    if (staffNotes) message += `\n진료메모: ${staffNotes}`;

    const callData = {
      patientName,
      chairNumber,
      doctorName: doctor?.name || '원장',
      message,
      type: 'doctor_call'
    };

    await supabase.channel('doctor_calls').send({
      type: 'broadcast',
      event: 'call_doctor',
      payload: { ...callData, timestamp: Date.now() }
    });

    // 3초 후 호출 상태 해제
    setTimeout(() => {
      setCallingPatientId(null);
    }, 3000);
  }, [supabase, doctors]);

  // 상태 변경
  const handleStatusChange = useCallback(async (patientId, newStatus) => {
    if (!supabase) return;

    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, status: newStatus } : p
    ));

    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.current_doctor_location = null;
      updateData.is_staff_mode = false;
    }

    await supabase.from('wait_patients')
      .update(updateData)
      .eq('id', patientId);
  }, [supabase, setPatients]);

  // 스텝 모드
  const handleStaffMode = useCallback(async (patientId) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || patient.status !== 'treatmenting') return;

    // 해당 환자에게 의사가 있었으면 재실로 변경
    const shouldClearLocation = patient.current_doctor_location === patient.doctor_id;

    setPatients(prev => prev.map(p =>
      p.id === patientId ? {
        ...p,
        is_staff_mode: true,
        current_doctor_location: shouldClearLocation ? null : p.current_doctor_location
      } : p
    ));

    const updateData = { is_staff_mode: true };
    if (shouldClearLocation) {
      updateData.current_doctor_location = null;
    }

    await supabase.from('wait_patients')
      .update(updateData)
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 스텝 모드 해제
  const handleExitStaffMode = useCallback(async (patientId) => {
    if (!supabase) return;

    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, is_staff_mode: false } : p
    ));

    await supabase.from('wait_patients')
      .update({ is_staff_mode: false })
      .eq('id', patientId);
  }, [supabase, setPatients]);

  // 회복실로 이동 - 체어번호, 원장 위치, 스텝모드 초기화
  const handleMoveToRecovery = useCallback(async (patientId) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || patient.status !== 'treatmenting') return;

    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? {
            ...p,
            is_recovery_room: true,
            chair_number: null,
            current_doctor_location: null,
            is_staff_mode: false,
            doctor_id: null
          }
        : p
    ));

    await supabase.from('wait_patients')
      .update({
        is_recovery_room: true,
        chair_number: null,
        current_doctor_location: null,
        is_staff_mode: false,
        doctor_id: null
      })
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 회복실에서 나가기 (진료 또는 완료)
  const handleExitRecovery = useCallback(async (patientId, newStatus) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.is_recovery_room) return;

    const updateData = {
      is_recovery_room: false,
      status: newStatus,
    };

    // 완료 시 추가 필드 초기화
    if (newStatus === 'completed') {
      updateData.current_doctor_location = null;
      updateData.is_staff_mode = false;
    }

    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, ...updateData } : p
    ));

    await supabase.from('wait_patients')
      .update(updateData)
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 상담 모드 설정
  const handleConsultingMode = useCallback(async (patientId) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.doctor_id) return;

    const consultingStartTime = Date.now();

    setPatients(prev => prev.map(p =>
      p.id === patientId ? {
        ...p,
        is_consulting_mode: true,
        consulting_start_time: consultingStartTime,
        consulting_actual_start_time: null
      } : p
    ));

    await supabase.from('wait_patients')
      .update({
        is_consulting_mode: true,
        consulting_start_time: consultingStartTime,
        consulting_actual_start_time: null
      })
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 상담 시작 (상담대기 → 상담중)
  const handleStartConsulting = useCallback(async (patientId) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.is_consulting_mode || patient.consulting_actual_start_time) return;

    const actualStartTime = Date.now();

    setPatients(prev => prev.map(p =>
      p.id === patientId ? {
        ...p,
        consulting_actual_start_time: actualStartTime
      } : p
    ));

    await supabase.from('wait_patients')
      .update({
        consulting_actual_start_time: actualStartTime
      })
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 상담대기 취소 (이전 상태로 복귀)
  const handleCancelConsultingWaiting = useCallback(async (patientId) => {
    if (!supabase) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.is_consulting_mode || patient.consulting_actual_start_time) return;

    // 해당 의사열의 환자들 중 최대 display_order 찾기
    const doctorPatients = patients.filter(p =>
      p.doctor_id === patient.doctor_id &&
      !p.is_consulting_mode &&
      !(p.is_staff_mode && p.status === 'treatmenting')
    );
    const maxOrder = doctorPatients.length > 0
      ? Math.max(...doctorPatients.map(p => p.display_order || 0))
      : 0;
    const newOrder = maxOrder + 1;

    setPatients(prev => prev.map(p =>
      p.id === patientId ? {
        ...p,
        is_consulting_mode: false,
        consulting_start_time: null,
        consulting_actual_start_time: null,
        display_order: newOrder
      } : p
    ));

    await supabase.from('wait_patients')
      .update({
        is_consulting_mode: false,
        consulting_start_time: null,
        consulting_actual_start_time: null,
        display_order: newOrder
      })
      .eq('id', patientId);
  }, [supabase, patients, setPatients]);

  // 의사 위치 업데이트 (이름 클릭 시)
  const handleDoctorLocationUpdate = useCallback(async (patientId) => {
    // 스텝/상담 탭에서는 위치 업데이트 불가
    if (!supabase || !selectedDoctorId || selectedDoctorId === 'staff' || selectedDoctorId === 'consulting') return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient || patient.status === 'completed') return;

    // 이미 의사가 있는 환자를 다시 클릭하면 재실로 이동
    if (patient.current_doctor_location === selectedDoctorId) {
      setPatients(prev => prev.map(p =>
        p.doctor_id === selectedDoctorId ? { ...p, current_doctor_location: null } : p
      ));

      await supabase.from('wait_patients')
        .update({ current_doctor_location: null })
        .eq('doctor_id', selectedDoctorId);
      return;
    }

    // 낙관적 업데이트: 모든 환자의 현재 의사 위치를 null로, 클릭한 환자만 현재 의사로 설정
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? { ...p, current_doctor_location: selectedDoctorId }
        : p.doctor_id === selectedDoctorId
          ? { ...p, current_doctor_location: null }
          : p
    ));

    // 먼저 해당 의사의 모든 환자에서 위치 표시 제거
    await supabase.from('wait_patients')
      .update({ current_doctor_location: null })
      .eq('doctor_id', selectedDoctorId);

    // 선택한 환자에게만 의사 위치 표시
    await supabase.from('wait_patients')
      .update({ current_doctor_location: selectedDoctorId })
      .eq('id', patientId);
  }, [supabase, selectedDoctorId, patients, setPatients]);

  // 원장 탭 더블클릭 시 원장실로 위치 (해당 원장의 모든 환자에서 위치 표시 제거)
  const handleDoctorTabDoubleClick = useCallback(async (doctorId) => {
    // 특별 탭 (미분류, 스텝, 상담)에서는 더블클릭 무시
    if (!supabase || !doctorId || doctorId === 'staff' || doctorId === 'consulting') return;

    // 낙관적 업데이트
    setPatients(prev => prev.map(p =>
      p.doctor_id === doctorId
        ? { ...p, current_doctor_location: null }
        : p
    ));

    await supabase.from('wait_patients')
      .update({ current_doctor_location: null })
      .eq('doctor_id', doctorId);
  }, [supabase, setPatients]);

  // 체어 번호 업데이트
  const handleChairNumberUpdate = useCallback(async (patientId, chairNumber) => {
    if (!supabase) return;

    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, chair_number: chairNumber } : p
    ));

    const { error } = await supabase.from('wait_patients')
      .update({ chair_number: chairNumber })
      .eq('id', patientId);

    if (error) {
      console.error('Error updating chair number:', error);
    }

    setShowChairSelect(null);
  }, [supabase, setPatients]);

  // 체어 선택 외부 클릭 시 닫기
  useEffect(() => {
    if (showChairSelect) {
      const handleClickOutside = () => setShowChairSelect(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChairSelect]);

  // 체어 선택 모달 열기
  const handleChairClick = useCallback((patientId, currentChair) => {
    setShowChairSelect({ patientId, currentChair });
  }, []);

  // 카드 확장/축소
  const handleCardToggle = (patientId) => {
    setExpandedCardId(prev => prev === patientId ? null : patientId);
  };

  // 드래그 앤 드롭
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id || !supabase) return;

    const oldIndex = selectedDoctorPatients.findIndex(p => p.id === active.id);
    const newIndex = selectedDoctorPatients.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedPatients = [...selectedDoctorPatients];
    const [movedPatient] = reorderedPatients.splice(oldIndex, 1);
    reorderedPatients.splice(newIndex, 0, movedPatient);

    const updates = reorderedPatients.map((patient, index) => ({
      id: patient.id,
      display_order: index
    }));

    setPatients(prev => {
      const newPatients = [...prev];
      updates.forEach(update => {
        const idx = newPatients.findIndex(p => p.id === update.id);
        if (idx !== -1) {
          newPatients[idx] = { ...newPatients[idx], display_order: update.display_order };
        }
      });
      return newPatients;
    });

    for (const update of updates) {
      await supabase.from('wait_patients')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }
  };

  const draggedPatient = activeDragId ? patients.find(p => p.id === activeDragId) : null;

  return (
    <div className="widget-container">
      {/* 헤더 - 드래그 영역 */}
      <div className="widget-header" style={{ WebkitAppRegion: 'drag' }}>
        {/* 상단: 컨트롤 버튼 */}
        <div className="header-top" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* 연결 상태 */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#10b981' : '#ef4444',
            flexShrink: 0
          }} />

          <span style={{ fontSize: '12px', color: '#888', flex: 1 }}>체어 위젯</span>

          {/* 최소화 */}
          <button
            onClick={() => window.electronAPI.minimize()}
            className="control-btn"
          >
            ─
          </button>

          {/* 세로 크기 토글 */}
          <button
            onClick={() => window.electronAPI.toggleHeight()}
            className="control-btn"
            title="세로 크기 토글"
          >
            ↕
          </button>

          {/* 숨기기 */}
          <button
            onClick={() => window.electronAPI.hide()}
            className="control-btn close"
          >
            ✕
          </button>
        </div>

        {/* 하단: 원장 탭 - 줄바꿈 가능 */}
        <div className="doctor-tabs" style={{ WebkitAppRegion: 'no-drag', flexWrap: 'wrap' }}>
          {doctorTabs.map(tab => {
            const isInOffice = tab.id && tab.id !== 'staff' && tab.id !== 'consulting' && tab.id !== 'recovery'
              ? isDoctorInOffice(tab.id)
              : false;

            return (
              <button
                key={tab.id ?? 'unassigned'}
                onClick={() => setSelectedDoctorId(tab.id)}
                onDoubleClick={() => handleDoctorTabDoubleClick(tab.id)}
                className={`doctor-tab ${selectedDoctorId === tab.id ? 'active' : ''} ${tab.id === 'recovery' ? 'recovery' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {/* 원장실에 있을 때 아이콘 표시 */}
                {isInOffice && (
                  <span style={{ fontSize: '14px', animation: 'pulse 2s infinite' }}>👨‍⚕️</span>
                )}
                {/* 스텝 탭 아이콘 */}
                {tab.id === 'staff' && (
                  <img src="./patient_female.png" alt="스텝" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                )}
                {/* 회복실 탭 아이콘 */}
                {tab.id === 'recovery' && (
                  <span style={{ fontSize: '14px' }}>🛏️</span>
                )}
                {tab.name} ({tab.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 환자 목록 */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={selectedDoctorPatients.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="patient-list">
            {selectedDoctorPatients.length === 0 ? (
              <div className="empty-message">
                {selectedDoctorId === null ? '대기열이 비어있습니다' :
                 selectedDoctorId === 'staff' ? '스텝 모드 환자가 없습니다' :
                 selectedDoctorId === 'consulting' ? '상담 환자가 없습니다' :
                 selectedDoctorId === 'recovery' ? '회복실 환자가 없습니다' :
                 '환자가 없습니다'}
              </div>
            ) : (
              selectedDoctorPatients.map(patient => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  isExpanded={expandedCardId === patient.id}
                  isDoctorHere={
                    selectedDoctorId !== 'staff' &&
                    selectedDoctorId !== 'consulting' &&
                    selectedDoctorId !== 'recovery' &&
                    patient.current_doctor_location === patient.doctor_id &&
                    patient.current_doctor_location !== null
                  }
                  doctorReply={doctorReplies[patient.id]}
                  onToggle={() => handleCardToggle(patient.id)}
                  onChairClick={handleChairClick}
                  onCallDoctor={handleCallDoctor}
                  onStatusChange={handleStatusChange}
                  onStaffMode={handleStaffMode}
                  onExitStaffMode={handleExitStaffMode}
                  onMoveToRecovery={handleMoveToRecovery}
                  onExitRecovery={handleExitRecovery}
                  onDoctorLocationUpdate={handleDoctorLocationUpdate}
                  onConsultingMode={handleConsultingMode}
                  onCancelConsultingWaiting={handleCancelConsultingWaiting}
                  onStartConsulting={handleStartConsulting}
                  isReadOnly={selectedDoctorId === 'consulting' || selectedDoctorId === 'recovery' || selectedDoctorId === null}
                  allowCallPatient={selectedDoctorId !== 'consulting' && selectedDoctorId !== 'staff' && selectedDoctorId !== 'recovery'}
                  isStaffTab={selectedDoctorId === 'staff'}
                  isRecoveryTab={selectedDoctorId === 'recovery'}
                  isConsultingTab={selectedDoctorId === 'consulting'}
                  isCallingDoctor={callingPatientId === patient.id}
                />
              ))
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {draggedPatient && (
            <PatientCard
              patient={draggedPatient}
              isExpanded={false}
              isDoctorHere={false}
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* 체어 번호 선택 모달 */}
      {showChairSelect && (
        <>
          {/* 배경 오버레이 */}
          <div
            onClick={() => setShowChairSelect(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 9998
            }}
          />

          {/* 모달 */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
              borderRadius: '16px',
              padding: '20px',
              width: '90%',
              maxWidth: '340px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* 헤더 */}
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.3rem',
                fontWeight: 'bold',
                color: 'white'
              }}>
                체어 번호 선택
              </h2>
              <p style={{
                margin: '8px 0 0',
                fontSize: '0.85rem',
                color: '#94a3b8'
              }}>
                환자를 배치할 체어 번호를 선택하세요
              </p>
            </div>

            {/* 체어 번호 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
              marginBottom: '12px'
            }}>
              {[...Array(20)].map((_, i) => {
                const num = i + 1;
                const isSelected = showChairSelect.currentChair === num;
                return (
                  <button
                    key={num}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleChairNumberUpdate(showChairSelect.patientId, num);
                    }}
                    style={{
                      padding: '12px 6px',
                      background: isSelected
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected
                        ? '2px solid #34d399'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: isSelected ? 'white' : '#94a3b8',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* 체어 번호 해제 버튼 */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                handleChairNumberUpdate(showChairSelect.patientId, null);
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              체어 번호 해제
            </button>

            {/* 현재 체어 안내 */}
            {showChairSelect.currentChair && (
              <div style={{
                textAlign: 'center',
                fontSize: '0.8rem',
                color: '#64748b',
                marginTop: '10px',
                padding: '6px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px'
              }}>
                현재: {showChairSelect.currentChair}번 체어
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ChairModeWidget;
