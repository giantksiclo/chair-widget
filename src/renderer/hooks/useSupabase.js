import { createClient } from '@supabase/supabase-js';
import { useState, useEffect, useRef } from 'react';

let supabaseInstance = null;

export function getSupabase(url, key) {
  if (!supabaseInstance && url && key) {
    try {
      supabaseInstance = createClient(url, key);
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
}

export function useSupabase(settings) {
  const [supabase, setSupabase] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (settings?.supabaseUrl && settings?.supabaseKey) {
      try {
        const client = getSupabase(settings.supabaseUrl, settings.supabaseKey);
        if (client) {
          setSupabase(client);
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Failed to initialize Supabase:', err);
      }
    }
  }, [settings?.supabaseUrl, settings?.supabaseKey]);

  return { supabase, isConnected };
}

export function useDoctors(supabase) {
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    let channel = null;

    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase.from('doctors').select('*').order('id');
        if (error) {
          console.error('Error fetching doctors:', error);
          return;
        }
        if (data) setDoctors(data);
      } catch (err) {
        console.error('Failed to fetch doctors:', err);
      }
    };

    fetchDoctors();

    try {
      channel = supabase.channel('doctors_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, fetchDoctors)
        .subscribe();
    } catch (err) {
      console.error('Failed to subscribe to doctors changes:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Failed to remove doctors channel:', err);
        }
      }
    };
  }, [supabase]);

  return doctors;
}

export function usePatients(supabase) {
  const [patients, setPatients] = useState([]);
  const patientsRef = useRef([]);

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    if (!supabase) return;

    let channel = null;

    const fetchPatients = async () => {
      try {
        const { data, error } = await supabase.from('wait_patients')
          .select('*')
          .in('status', ['waiting', 'treatmenting'])
          .order('display_order', { ascending: true })
          .order('id', { ascending: true });
        if (error) {
          console.error('Error fetching patients:', error);
          return;
        }
        if (data) setPatients(data);
      } catch (err) {
        console.error('Failed to fetch patients:', err);
      }
    };

    fetchPatients();

    try {
      channel = supabase.channel('patients_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wait_patients' }, fetchPatients)
        .subscribe();
    } catch (err) {
      console.error('Failed to subscribe to patients changes:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Failed to remove patients channel:', err);
        }
      }
    };
  }, [supabase]);

  return { patients, setPatients, patientsRef };
}

export function useDoctorReplies(supabase, patients) {
  const [doctorReplies, setDoctorReplies] = useState({});

  useEffect(() => {
    if (!supabase || !patients || !patients.length) return;

    let channel = null;

    const loadExistingReplies = async () => {
      try {
        const treatmentingPatients = patients.filter(p => p.status === 'treatmenting');
        if (treatmentingPatients.length === 0) return;

        const patientNames = treatmentingPatients.map(p => p.name);

        const { data, error } = await supabase
          .from('doctor_replies')
          .select('patient_name, reply, icon, created_at')
          .in('patient_name', patientNames)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching doctor replies:', error);
          return;
        }

        if (data && data.length > 0) {
          const newReplies = {};
          data.forEach(row => {
            const patient = treatmentingPatients.find(p => p.name === row.patient_name);
            if (patient && !newReplies[patient.id]) {
              newReplies[patient.id] = {
                reply: row.reply,
                icon: row.icon,
                timestamp: row.created_at
              };
            }
          });
          setDoctorReplies(prev => ({ ...prev, ...newReplies }));
        }
      } catch (err) {
        console.error('Failed to load doctor replies:', err);
      }
    };

    loadExistingReplies();

    // 실시간 구독
    try {
      channel = supabase.channel('doctor_replies_sub')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'doctor_replies' }, (payload) => {
          try {
            const { patient_name, reply, icon, created_at } = payload.new;
            const patient = patients.find(p => p.name === patient_name);
            if (patient) {
              setDoctorReplies(prev => ({
                ...prev,
                [patient.id]: { reply, icon, timestamp: created_at }
              }));

              // 15초 후 자동 제거
              setTimeout(() => {
                setDoctorReplies(prev => {
                  const newReplies = { ...prev };
                  delete newReplies[patient.id];
                  return newReplies;
                });
              }, 15000);
            }
          } catch (err) {
            console.error('Error handling doctor reply:', err);
          }
        })
        .subscribe();
    } catch (err) {
      console.error('Failed to subscribe to doctor replies:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error('Failed to remove doctor replies channel:', err);
        }
      }
    };
  }, [supabase, patients]);

  return doctorReplies;
}
