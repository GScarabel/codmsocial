"use client";

import React, { useEffect, useState, useRef } from "react";
import Perfil from "../../components/Perfil"; // ajuste o caminho

interface PerfilPageProps {
  params: { uid: string };
}

const PerfilPage: React.FC<PerfilPageProps> = ({ params }) => {
  return <Perfil userId={params.uid} />;
};

export default PerfilPage;

