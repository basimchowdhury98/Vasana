I want a deep tutorial outline on applied cryptography for an experienced developer who already knows the basics and wants to really master the space.

Topic coverage should include:
- hashing
- symmetric cryptography
- asymmetric cryptography
- digital signatures
- certificates
- SSH
- PGP

Learner profile:
- experienced developer
- already knows basic crypto concepts
- wants a deeper understanding of how these systems work in practice
- wants to know when to use which tool and how to think cryptographically

Constraints:
- prefer modern applied cryptography
- I am also okay with small from-scratch implementations when they help build intuition

Structure preferences:
- this should be a cohesive applied-security track, not just a broad survey
- target about 6 to 8 modules
- each module must be actionable and support a distinct mini-project, lab, exercise, or concrete deliverable
- I want a mix of three styles across the tutorial: small implementations, safe use of real libraries/tools, and analysis of weak or misused schemes
- for certificates, cover both TLS/X.509 certificate chains and internal PKI / issuing certs
- for PGP, cover both practical file or email signing/encryption workflows and deeper trust/key-management concerns
- for SSH, cover both daily key usage/agent workflows and host verification, known_hosts, and SSH certificates
- each module should build concrete capability, not just theory
- separate mini-projects per module, not one single capstone

Please propose a concrete module outline first, not research resources yet.

The outline should feel very similar to one that would likely include modules in this spirit:
- hash integrity and MAC misuse analysis
- safe symmetric encryption with tamper detection
- asymmetric crypto and hybrid encryption
- signatures and trust design
- TLS certificates and a small PKI lab
- SSH authentication, host trust, and SSH certificates
- PGP encryption, signing, and key trust

Keep the module titles crisp and make each description specific enough that a later research phase could find practical resources and exercises.
