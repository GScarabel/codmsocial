"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  HiOutlineCalendar,
  HiOutlineExternalLink,
  HiOutlineCheck,
  HiOutlinePencil,
  HiOutlineX,
  HiOutlineLogout,
  HiArrowLeft,
  HiOutlineNewspaper,
} from "react-icons/hi";
import { Navbar, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Tooltip } from "@heroui/tooltip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { useRouter } from "next/navigation";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Code } from "@heroui/code";
import { BreadcrumbItem, Breadcrumbs } from "@heroui/breadcrumbs";

interface PerfilUser {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  organizationTag?: string;
  createdAt?: Date;
}

interface PerfilProps {
  userId?: string;
}

const navigation = [
  { label: "Retornar", icon: <HiArrowLeft className="w-5 h-5" /> },
];

const Perfil: React.FC<PerfilProps> = ({ userId }) => {
  const [authUser, setAuthUser] = useState<PerfilUser | null>(null);
  const [profileUser, setProfileUser] = useState<PerfilUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [organizationTag, setOrganizationTag] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleLogout = async () => await signOut(auth);
  const isOwnProfile = !userId || userId === auth.currentUser?.uid;

  // --- Carrega usuário logado ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const ref = doc(db, "Users", currentUser.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};

        setAuthUser({
          uid: currentUser.uid,
          displayName: data.displayName || currentUser.displayName || "Usuário",
          email: data.email || currentUser.email || "",
          photoURL: data.photoURL || currentUser.photoURL || "",
          organizationTag: data.organizationTag || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        });
      }
    });

    return () => unsub();
  }, []);

  // --- Carrega perfil visitado ou próprio ---
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const uidToFetch = userId || auth.currentUser?.uid;
        if (!uidToFetch) return;

        const snap = await getDoc(doc(db, "Users", uidToFetch));
        const data = snap.exists() ? snap.data() : {};

        const perfil: PerfilUser = {
          uid: uidToFetch,
          displayName: data.displayName || "",
          email: data.email || "",
          photoURL: data.photoURL || "",
          organizationTag: data.organizationTag || "",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        };

        setProfileUser(perfil);
        setName(perfil.displayName);
        setAvatar(perfil.photoURL || "");
        setOrganizationTag(perfil.organizationTag || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // --- Salva nome ---
  const handleSave = async () => {
    if (!profileUser) return;

    try {
      const ref = doc(db, "Users", profileUser.uid);
      await updateDoc(ref, { displayName: name });

      if (auth.currentUser?.uid === profileUser.uid) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      // Atualiza estado usando non-null assertion
      setProfileUser({ ...profileUser, displayName: name });

      setEditMode(false);
      addToast({ title: "Sucesso", description: "Nome atualizado!", color: "success" });
    } catch (err) {
      console.error(err);
      addToast({ title: "Erro", description: "Falha ao atualizar nome.", color: "danger" });
    }
  };

  // --- Salva avatar ---
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=b1356253eee00f53fbcbe77dad8acae8`, { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) throw new Error("Falha no upload");

      const newPhotoURL = data.data.url;

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });
        await updateDoc(doc(db, "Users", auth.currentUser.uid), { photoURL: newPhotoURL });
      }

      setAvatar(newPhotoURL);

      if (profileUser?.uid === auth.currentUser?.uid && profileUser) {
        setProfileUser({ ...profileUser, photoURL: newPhotoURL });
      }

      addToast({ title: "Sucesso", description: "Foto atualizada!", color: "success" });
    } catch {
      addToast({ title: "Erro", description: "Erro ao enviar imagem.", color: "danger" });
    }
  };

  if (loading) return <p className="text-center mt-10">Carregando perfil...</p>;
  if (!profileUser) return <p className="text-center mt-10 text-red-500">Usuário não encontrado.</p>;

  return (
   <div>
  {isOwnProfile ? null : (
    <>
    <Navbar>
      
      <NavbarContent justify="start">
        {navigation.map((n) => (
          <NavbarItem key={n.label}>
            <Tooltip content={n.label} placement="bottom">
              <Button onPress={() => router.push("/")}>{n.icon}</Button>
            </Tooltip>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarContent justify="end">
                  <Button color="danger" onPress={handleLogout}>
                    <HiOutlineLogout className="w-5 h-5" />
                  </Button>
        {authUser && (
          <>
            <Dropdown>
              <DropdownTrigger>
                <div className="group h-12 w-12 rounded-full overflow-hidden border-2 border-white/30 bg-gray-700 flex items-center justify-center cursor-pointer">
                  <img
                    alt="Avatar"
                    src={authUser.photoURL || "/default-avatar.png"}
                    className="h-full w-full object-cover"
                  />
                </div>
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem
                  key="change-photo"
                  onPress={() => inputRef.current?.click()}
                >
                  Alterar Foto
                </DropdownItem>
                <DropdownItem
                  key="change-name"
                  onPress={() => setShowNameModal(true)}
                >
                  Alterar Nome
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </>
        )}
      </NavbarContent>
    </Navbar>

  <div
    style={{
      maxWidth: 800,
      margin: "0 auto",
      marginTop: 0,
      marginBottom: 10,
      paddingLeft: 25,
    }}
  >
    <Breadcrumbs>
      <BreadcrumbItem
        startContent={<HiOutlineNewspaper />}
        onPress={() => router.push("/")}
      >
        Feed
      </BreadcrumbItem>
      <BreadcrumbItem>{profileUser.displayName}</BreadcrumbItem>
    </Breadcrumbs>
  </div>
</>
  )}


<Modal isOpen={showNameModal} onOpenChange={setShowNameModal}>
  <ModalContent>
    <ModalHeader>Editar Nome</ModalHeader>
    <ModalBody>
      <div className="flex flex-col gap-4">
        {/* Nome atual */}
        <div>
          <Code className="mb-2" color="primary">
            Seu nome atual
          </Code>
          <div className="flex items-center gap-2">
            {authUser?.organizationTag && (
              <Code
                className="flex items-center px-2 h-[38px] text-sm rounded"
                color="danger"
              >
                {authUser.organizationTag}
              </Code>
            )}
            <Input
              disabled
              className="h-[38px]"
              type="text"
              value={authUser?.displayName || ""}
            />
          </div>
        </div>

        {/* Novo nome */}
        <div>
          <Code className="mb-2" color="primary">
            Seu novo nome
          </Code>
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button onPress={() => setShowNameModal(false)}>Cancelar</Button>
      <Button
        color="primary"
        onPress={async () => {
          if (!newName.trim() || !authUser) return;

          try {
            // Atualiza no Firestore
            await updateDoc(doc(db, "Users", authUser.uid), { displayName: newName });

            // Atualiza no Firebase Auth
            if (auth.currentUser) {
              await updateProfile(auth.currentUser, { displayName: newName });
            }

            // Atualiza estado local
            setAuthUser({ ...authUser, displayName: newName });
            setShowNameModal(false);
            addToast({ title: "Sucesso", description: "Nome atualizado!", color: "success" });
          } catch (err) {
            console.error(err);
            addToast({ title: "Erro", description: "Falha ao atualizar nome.", color: "danger" });
          }
        }}
      >
        Salvar
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>

      {/* Perfil */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 0 }}>
        <Card className="space-y-6 mr-5 ml-5">
          <CardHeader className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-white/30 bg-gray-700">
              <img src={profileUser.photoURL || "/default-avatar.png"} alt="Avatar" className="h-full w-full object-cover" />
            </div>

            {isOwnProfile ? (
              editMode ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
              ) : (
                <h2 className="text-3xl font-bold">{profileUser.displayName}</h2>
              )
            ) : (
              <h2 className="text-3xl font-bold">{profileUser.displayName}</h2>
            )}
          </CardHeader>

          <Divider />

          <CardBody className="space-y-3 text-gray-700">
            <div className="flex items-center gap-2">
              <HiOutlineExternalLink className="w-5 h-5 text-gray-500" />
              <span>{profileUser.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="w-5 h-5 text-gray-500" />
              <span>
                Criado em: {profileUser.createdAt ? profileUser.createdAt.toLocaleDateString() : "—"}
              </span>
            </div>
          </CardBody>

          {isOwnProfile && (
            <CardFooter className="flex justify-between">
              {editMode ? (
                <>
                  <Button color="primary" onPress={handleSave} startContent={<HiOutlineCheck />}>Salvar</Button>
                  <Button color="danger" onPress={() => setEditMode(false)} startContent={<HiOutlineX />}>Cancelar</Button>
                </>
              ) : (
                <>
                  <Button onPress={() => setEditMode(true)} startContent={<HiOutlinePencil />}>Editar Nome</Button>
                  <Button color="danger" onPress={() => signOut(auth)} startContent={<HiOutlineLogout />}>Sair</Button>
                </>
              )}
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Perfil;