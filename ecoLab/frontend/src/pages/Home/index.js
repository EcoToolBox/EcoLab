
import { Box} from "@mui/material";
import StepActions from "../../components/StepActions";
import Theme from "../../layout/Theme";

export default function Home({}) {
  
  return (

    <Theme>
        <Box
            sx={{
            fontFamily: 'Poppins, sans-serif',
            }}
        >
        
        <p
          style={{
            color: "#333",
            padding: "20px",
            fontSize: "1.2rem",
            }}
        >
            Bem-vindo ao EcoLab! <br />
            Para começar, selecione as espécies que deseja incluir em sua análise. <br />
            Você pode usar a barra de busca para encontrar espécies pelo nome ou explorar a árvore taxonômica para descobrir novas espécies relacionadas. <br />
            À medida que você seleciona as espécies, elas aparecerão na lista ao lado, e você poderá revisar ou remover suas escolhas a qualquer momento. <br />
            Quando estiver satisfeito com sua seleção, clique em 'Próximo' para avançar para a etapa de filtros e personalizar ainda mais sua consulta.<br />
            <br />
            Vamos começar a explorar a biodiversidade juntos!
            </p>
        </Box>

        <StepActions selectedSpecies={[]}
        />
    </Theme>
  );
}
