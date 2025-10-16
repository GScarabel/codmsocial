"use client";

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Avatar } from '@heroui/avatar';
import { Button } from '@heroui/button';
import { Spinner } from '@heroui/spinner';
import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal';
import { 
  HiOutlineSearch, 
  HiOutlineUsers, 
  HiOutlineGlobe, 
  HiOutlineUserAdd,
  HiOutlineFilter
} from 'react-icons/hi';
import { User } from 'firebase/auth';
import { addToast } from '@heroui/toast';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Organization, Membership, MembershipStatus } from '../types';

interface ExplorarOrganizacoesProps {
  user: User | null;
  organizations: Organization[];
  loading: boolean;
}

const ExplorarOrganizacoes: React.FC<ExplorarOrganizacoesProps> = ({
  user,
  organizations,
  loading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [requesting, setRequesting] = useState<string | null>(null);
  const [userMemberships, setUserMemberships] = useState<{[orgId: string]: Membership}>({});
  const [pendingRequests, setPendingRequests] = useState<{[orgId: string]: boolean}>({});

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMembers, setModalMembers] = useState<Membership[]>([]);
  const [modalOrgName, setModalOrgName] = useState('');
  const [modalMemberFilter, setModalMemberFilter] = useState('');
  const [modalMembersWithUserData, setModalMembersWithUserData] = useState<(Membership & { displayName?: string; photoURL?: string })[]>([]);

  // Verificar memberships do usuário
  const checkUserMemberships = async () => {
    if (!user) return;

    const memberships: {[orgId: string]: Membership} = {};
    const pending: {[orgId: string]: boolean} = {};

    for (const org of organizations) {
      try {
        const membershipQuery = query(
          collection(db, `organizations/${org.id}/memberships`),
          where('userId', '==', user.uid)
        );
        
        const membershipSnapshot = await getDocs(membershipQuery);
        
        if (!membershipSnapshot.empty) {
          const membershipData = membershipSnapshot.docs[0].data() as Membership;
          memberships[org.id] = membershipData;
          
          if (membershipData.status === 'pending') {
            pending[org.id] = true;
          }
        }
      } catch (error) {
        console.error(`Erro ao verificar membership para organização ${org.id}:`, error);
      }
    }

    setUserMemberships(memberships);
    setPendingRequests(pending);
  };

  React.useEffect(() => {
    if (user && organizations.length > 0) {
      checkUserMemberships();
    }
  }, [user, organizations]);

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (org.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVisibility = visibilityFilter === 'all' || org.visibility === visibilityFilter;
    
    return matchesSearch && matchesVisibility;
  });

  const handleRequestToJoin = async (orgId: string) => {
    if (!user) {
      addToast({ title: "Erro", description: "Você precisa estar logado", color: "danger" });
      return;
    }

    const isMemberOfAnyOrg = Object.values(userMemberships).some(
      m => m.status === 'accepted'
    );
    if (isMemberOfAnyOrg) {
      addToast({ 
        title: "Aviso", 
        description: "Você já é membro de uma organização e não pode solicitar entrada em outra", 
        color: "warning" 
      });
      return;
    }

    if (userMemberships[orgId]) {
      if (userMemberships[orgId].status === 'accepted') {
        addToast({ title: "Aviso", description: "Você já é membro desta organização", color: "warning" });
        return;
      }
      if (userMemberships[orgId].status === 'pending') {
        addToast({ title: "Aviso", description: "Você já tem uma solicitação pendente para esta organização", color: "warning" });
        return;
      }
    }

    setRequesting(orgId);
    
    try {
      const membershipData: Omit<Membership, 'id'> = {
        organizationId: orgId,
        userId: user.uid,
        role: 'ranked',
        status: 'pending' as MembershipStatus,
        joinedAt: null,
        updatedAt: serverTimestamp() as any,
        invitedBy: user.uid,
        invitedAt: serverTimestamp() as any,
        roleHistory: [],
        displayName: user.displayName || user.email || 'Usuário',
        photoURL: user.photoURL || ''
      };

      await setDoc(doc(db, `organizations/${orgId}/memberships`, user.uid), membershipData);
      await addDoc(collection(db, "memberships"), membershipData);

      setUserMemberships(prev => ({
        ...prev,
        [orgId]: { ...membershipData, id: user.uid }
      }));
      setPendingRequests(prev => ({
        ...prev,
        [orgId]: true
      }));

      addToast({ 
        title: "Solicitação enviada", 
        description: "Sua solicitação foi enviada para a organização e aguarda aprovação", 
        color: "success" 
      });
    } catch (error) {
      console.error("❌ Erro ao solicitar entrada:", error);
      addToast({ 
        title: "Erro", 
        description: "Falha ao enviar solicitação. Tente novamente.", 
        color: "danger" 
      });
    } finally {
      setRequesting(null);
    }
  };

  const openMembersModal = async (orgId: string, orgName: string) => {
    try {
      const membersSnap = await getDocs(collection(db, `organizations/${orgId}/memberships`));
      const membersData: Membership[] = membersSnap.docs.map(doc => doc.data() as Membership);
      
      // Buscar dados dos usuários para cada membro
      const membersWithUserData = await Promise.all(
        membersData.map(async (member) => {
          try {
            // Primeiro tenta buscar no documento do membership
            if (member.displayName && member.photoURL) {
              return {
                ...member,
                displayName: member.displayName,
                photoURL: member.photoURL
              };
            }
            
            const userDoc = await getDoc(doc(db, 'users', member.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                ...member,
                displayName: userData.displayName || userData.name || userData.email || 'Usuário',
                photoURL: userData.photoURL || userData.avatar || ''
              };
            }
            
            // Fallback se não encontrar o usuário
            return {
              ...member,
              displayName: member.userId,
              photoURL: ''
            };
          } catch (error) {
            console.error(`Erro ao buscar dados do usuário ${member.userId}:`, error);
            return {
              ...member,
              displayName: member.userId,
              photoURL: ''
            };
          }
        })
      );
      
      setModalMembers(membersData);
      setModalMembersWithUserData(membersWithUserData);
      setModalOrgName(orgName);
      setModalMemberFilter('');
      setModalOpen(true);
    } catch (error) {
      console.error('Erro ao buscar membros da organização:', error);
      addToast({ title: 'Erro', description: 'Não foi possível carregar membros', color: 'danger' });
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Faça login para explorar organizações</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
    <Card className="space-y-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold ml-5 mt-3">Explorar Organizações</h2>
          <p className="text-gray-600 ml-5">Descubra e junte-se a organizações da comunidade</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 ml-5 mr-5 -mt-3">
          <Input
            placeholder="Buscar por nome, tag ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            startContent={<HiOutlineSearch className="w-4 h-4 text-gray-400" />}
            className="flex-1"
          />
          <Select
            placeholder="Filtrar por visibilidade"
            selectedKeys={[visibilityFilter]}
            onSelectionChange={(keys) => setVisibilityFilter(Array.from(keys)[0] as string)}
            className="w-full sm:w-48"
            startContent={<HiOutlineFilter className="w-4 h-4" />}
          >
            <SelectItem key="all">Todas</SelectItem>
            <SelectItem key="public">Públicas</SelectItem>
            <SelectItem key="private">Privadas</SelectItem>
          </Select>
        </div>

        {filteredOrganizations.length === 0 ? (
          <div className="text-center py-12">
            <HiOutlineGlobe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchTerm ? 'Nenhuma organização encontrada' : 'Nenhuma organização disponível'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Tente ajustar os filtros de busca' 
                : 'Não há organizações públicas disponíveis no momento'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrganizations.map((org) => {
              const isOwner = org.ownerId === user.uid;
              const membership = userMemberships[org.id];
              const isMember = membership && membership.status === 'accepted';
              const hasPendingRequest = membership && membership.status === 'pending';
              const isMemberOfAnyOrg = Object.values(userMemberships).some(m => m.status === 'accepted');

              return (
                <Card key={org.id} className="hover:shadow-lg transition-shadow ml-5 mb-5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3 w-full">
                      <Avatar
                        src={org.logoURL}
                        name={org.name}
                        size="md"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{org.name}</h3>
                        <div className="flex items-center gap-2">
                          <Chip size="sm" variant="flat" color="primary">
                            {org.tag}
                          </Chip>
                          <Chip 
                            size="sm" 
                            variant="dot" 
                            color={org.visibility === 'public' ? 'success' : 'default'}
                          >
                            {org.visibility === 'public' ? 'Pública' : 'Privada'}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardBody className="pt-0">
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {org.description || "Sem descrição disponível"}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <HiOutlineUsers className="w-4 h-4" />
                          <span>{org.memberCount || 1} membros</span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-400">
                        Criada em {new Date(org.createdAt?.toDate?.() || org.createdAt).toLocaleDateString()}
                      </div>

                      <div className="pt-2">
                        {isOwner ? (
                          <Chip size="sm" color="warning" variant="flat" className="w-full">
                            👑 Sua Organização
                          </Chip>
                        ) : isMember ? (
                          <Chip size="sm" color="success" variant="flat" className="w-full">
                            ✅ Você é membro
                          </Chip>
                        ) : hasPendingRequest ? (
                          <Chip size="sm" color="default" variant="flat" className="w-full">
                            ⏳ Solicitação pendente
                          </Chip>
                        ) : !isMemberOfAnyOrg ? (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            startContent={<HiOutlineUserAdd className="w-3 h-3" />}
                            onClick={() => handleRequestToJoin(org.id)}
                            isLoading={requesting === org.id}
                            className="w-full"
                          >
                            {requesting === org.id ? 'Enviando...' : 'Solicitar Entrada'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            color="secondary"
                            variant="flat"
                            onClick={() => openMembersModal(org.id, org.name)}
                            className="w-full"
                          >
                            Ver Membros
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Card>

    {modalOpen && (
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3>{`Membros de ${modalOrgName}`}</h3>
            <Input
              placeholder="Filtrar membros por nome..."
              value={modalMemberFilter}
              onChange={(e) => setModalMemberFilter(e.target.value)}
              startContent={<HiOutlineSearch className="w-4 h-4 text-default-400" />}
              size="sm"
              className="mt-2"
            />
          </ModalHeader>
          <ModalBody className="space-y-3 max-h-96 overflow-y-auto">
            {modalMembersWithUserData.length === 0 ? (
              <p className="text-default-500 text-center py-4">Nenhum membro encontrado</p>
            ) : (
              modalMembersWithUserData
                .filter(member => 
                  !modalMemberFilter || 
                  (member.displayName || '').toLowerCase().includes(modalMemberFilter.toLowerCase())
                )
                .map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 bg-default-100 dark:bg-default-50 rounded-lg border border-default-200 dark:border-default-100">
                    <div className="flex items-center gap-3">
                      <Avatar 
                        src={member.photoURL} 
                        name={member.displayName || member.userId}
                        size="md"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-default-900 dark:text-default-800">
                          {member.displayName || member.userId}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={
                              member.role === 'owner' ? 'warning' :
                              member.role === 'manager' ? 'secondary' :
                              member.role === 'pro' ? 'primary' : 'default'
                            }
                          >
                            {member.role === 'owner' ? '👑 Owner' :
                             member.role === 'manager' ? '⚡ Manager' :
                             member.role === 'pro' ? '🌟 Pro Player' : '🎮 Ranked'}
                          </Chip>
                          <Chip 
                            size="sm" 
                            variant="dot" 
                            color={member.status === 'accepted' ? 'success' : 'default'}
                          >
                            {member.status === 'accepted' ? 'Aceito' : 
                             member.status === 'pending' ? 'Pendente' : member.status}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
            {modalMembersWithUserData.filter(member => 
              !modalMemberFilter || 
              (member.displayName || '').toLowerCase().includes(modalMemberFilter.toLowerCase())
            ).length === 0 && modalMemberFilter && (
              <p className="text-default-500 text-center py-4">
                Nenhum membro encontrado com o nome "{modalMemberFilter}"
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setModalOpen(false)} color="primary">
              Fechar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )}
    </>
  );
};

export default ExplorarOrganizacoes;